import { NextRequest, NextResponse } from "next/server";
import { stripe, WALLET_MIN_TOPUP_USD, WALLET_MAX_TOPUP_USD } from "@/lib/stripe";
import { requireUser } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://getfansee.com";

type CheckoutPayload = {
  /** Amount in USD */
  amountUsd: number;
};

/**
 * POST /api/payments/create-checkout-session
 * Creates a Stripe Checkout Session for wallet top-up.
 * On success, returns { url } — the client should redirect there.
 * After payment, Stripe redirects to /me/wallet?payment=success
 * and fires a webhook that credits the wallet.
 */
export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { success: false, error: "Payment service is not configured" },
        { status: 503 }
      );
    }

    const { user } = await requireUser();
    const body = (await request.json()) as CheckoutPayload;
    const { amountUsd } = body;

    if (!amountUsd || amountUsd < WALLET_MIN_TOPUP_USD || amountUsd > WALLET_MAX_TOPUP_USD) {
      return NextResponse.json(
        {
          success: false,
          error: `Amount must be between $${WALLET_MIN_TOPUP_USD} and $${WALLET_MAX_TOPUP_USD}`,
        },
        { status: 400 }
      );
    }

    const amountCents = Math.round(amountUsd * 100);

    // Fetch user profile for pre-filling Stripe checkout
    const admin = getSupabaseAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "GetFanSee Wallet Top-Up",
              description: `Add $${amountUsd.toFixed(2)} to your GetFanSee wallet`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      customer_email: user.email,
      metadata: {
        user_id: user.id,
        display_name: profile?.display_name || "",
        amount_cents: String(amountCents),
        type: "wallet_topup",
      },
      success_url: `${SITE_URL}/me/wallet?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/me/wallet?payment=cancelled`,
      payment_intent_data: {
        description: `GetFanSee wallet top-up for user ${user.id}`,
        statement_descriptor_suffix: "GETFANSEE",
        metadata: {
          user_id: user.id,
          amount_cents: String(amountCents),
          type: "wallet_topup",
        },
      },
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
