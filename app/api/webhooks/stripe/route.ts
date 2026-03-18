import { NextRequest, NextResponse } from "next/server";
import { stripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type Stripe from "stripe";

/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events.
 *
 * Required events to enable in Stripe Dashboard:
 *   - checkout.session.completed
 *   - payment_intent.payment_failed
 *
 * Set STRIPE_WEBHOOK_SECRET in env from:
 *   stripe listen --forward-to localhost:3000/api/webhooks/stripe
 */
export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig || !STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe-webhook] Missing signature or webhook secret");
    return NextResponse.json({ error: "Missing webhook signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_status !== "paid") {
        break;
      }

      const metadata = session.metadata;
      if (!metadata?.user_id || metadata?.type !== "wallet_topup") {
        console.warn("[stripe-webhook] checkout.session.completed: unexpected metadata", metadata);
        break;
      }

      const userId = metadata.user_id;
      const amountCents = parseInt(metadata.amount_cents, 10);

      if (!userId || isNaN(amountCents) || amountCents <= 0) {
        console.error("[stripe-webhook] Invalid metadata:", metadata);
        break;
      }

      // Idempotency: check if this session was already processed
      const { data: existingTx } = await admin
        .from("transactions")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "deposit")
        .eq("status", "completed")
        .contains("metadata", { stripe_session_id: session.id })
        .maybeSingle();

      if (existingTx) {
        // Idempotent: already processed
        break;
      }

      // Record deposit transaction
      const { error: txError } = await admin.from("transactions").insert({
        user_id: userId,
        type: "deposit",
        amount_cents: amountCents,
        status: "completed",
        metadata: {
          payment_method: "stripe",
          stripe_session_id: session.id,
          stripe_payment_intent: session.payment_intent,
        },
      });

      if (txError) {
        console.error("[stripe-webhook] Failed to insert transaction:", txError);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }

      // Credit wallet balance
      const { data: currentWallet } = await admin
        .from("wallet_accounts")
        .select("available_balance_cents, pending_balance_cents")
        .eq("user_id", userId)
        .maybeSingle();

      const currentBalance = currentWallet?.available_balance_cents ?? 0;
      const newBalance = currentBalance + amountCents;

      const { error: walletError } = await admin.from("wallet_accounts").upsert(
        {
          user_id: userId,
          available_balance_cents: newBalance,
          pending_balance_cents: currentWallet?.pending_balance_cents ?? 0,
        },
        { onConflict: "user_id" }
      );

      if (walletError) {
        console.error("[stripe-webhook] Failed to update wallet:", walletError);
        return NextResponse.json({ error: "Wallet update failed" }, { status: 500 });
      }

      // Wallet credited successfully
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.warn(
        "[stripe-webhook] Payment failed:",
        paymentIntent.id,
        paymentIntent.last_payment_error?.message
      );
      break;
    }

    default:
      // Unhandled event types are safe to ignore
      break;
  }

  return NextResponse.json({ received: true });
}
