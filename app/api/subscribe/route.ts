import { NextRequest, NextResponse } from "next/server";
import { subscribe30d } from "@/lib/paywall";
import { getCurrentUser } from "@/lib/auth-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendSubscriptionConfirmation } from "@/lib/email";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://getfansee.com";

type SubscribePayload = {
  creatorId?: string;
  priceCents?: number;
};

export async function POST(request: NextRequest) {
  try {
    const { creatorId, priceCents } = (await request.json()) as SubscribePayload;

    if (!creatorId) {
      return NextResponse.json({ success: false, error: "creatorId is required" }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdminClient();

    // 1. Fetch creator profile to get subscription price (if not provided)
    const { data: creatorProfile } = await admin
      .from("profiles")
      .select("display_name, subscription_price_cents")
      .eq("id", creatorId)
      .maybeSingle();

    const subscriptionPriceCents = priceCents ?? creatorProfile?.subscription_price_cents ?? 0;
    const creatorName = creatorProfile?.display_name || "Creator";

    // 2. If subscription has a price, deduct from fan wallet first
    if (subscriptionPriceCents > 0) {
      // 2a. Check fan wallet balance
      const { data: fanWallet } = await admin
        .from("wallet_accounts")
        .select("available_balance_cents")
        .eq("user_id", user.id)
        .maybeSingle();

      const currentBalance = fanWallet?.available_balance_cents ?? 0;
      if (currentBalance < subscriptionPriceCents) {
        return NextResponse.json(
          {
            success: false,
            error: "Insufficient wallet balance",
            balance_cents: currentBalance,
            required_cents: subscriptionPriceCents,
          },
          { status: 402 }
        );
      }

      // 2b. Deduct fan wallet balance
      const newFanBalance = currentBalance - subscriptionPriceCents;
      const { error: deductError } = await admin
        .from("wallet_accounts")
        .upsert(
          { user_id: user.id, available_balance_cents: newFanBalance, pending_balance_cents: 0 },
          { onConflict: "user_id" }
        );

      if (deductError) {
        console.error("[api/subscribe] wallet deduct error:", deductError);
        return NextResponse.json(
          { success: false, error: "Balance deduction failed" },
          { status: 500 }
        );
      }

      // 2c. Create subscription record
      const success = await subscribe30d(creatorId);
      if (!success) {
        // Rollback wallet deduction on subscription failure
        await admin
          .from("wallet_accounts")
          .upsert(
            { user_id: user.id, available_balance_cents: currentBalance, pending_balance_cents: 0 },
            { onConflict: "user_id" }
          );
        return NextResponse.json(
          { success: false, error: "Failed to create subscription" },
          { status: 500 }
        );
      }

      // 2d. Record fan debit transaction
      await admin.from("transactions").insert({
        user_id: user.id,
        type: "subscription",
        amount_cents: -subscriptionPriceCents,
        status: "completed",
        metadata: {
          creator_id: creatorId,
          billing_period: "monthly",
        },
      });

      // 2e. Record creator pending revenue transaction
      await admin.from("transactions").insert({
        user_id: creatorId,
        type: "subscription",
        amount_cents: subscriptionPriceCents,
        status: "pending",
        available_on: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          fan_id: user.id,
          billing_period: "monthly",
        },
      });

      // 2f. Update creator pending balance
      const { data: creatorWallet } = await admin
        .from("wallet_accounts")
        .select("available_balance_cents, pending_balance_cents")
        .eq("user_id", creatorId)
        .maybeSingle();

      await admin.from("wallet_accounts").upsert(
        {
          user_id: creatorId,
          available_balance_cents: creatorWallet?.available_balance_cents ?? 0,
          pending_balance_cents:
            (creatorWallet?.pending_balance_cents ?? 0) + subscriptionPriceCents,
        },
        { onConflict: "user_id" }
      );
    } else {
      // Free subscription — just create the record
      const success = await subscribe30d(creatorId);
      if (!success) {
        return NextResponse.json({ success: false, error: "Failed to subscribe" }, { status: 500 });
      }
    }

    // 3. Send order confirmation email (non-blocking)
    try {
      const { data: profileRes } = await admin
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      const fanName = profileRes?.display_name || user.email.split("@")[0];
      const nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(
        "en-US",
        { year: "numeric", month: "long", day: "numeric" }
      );

      await sendSubscriptionConfirmation({
        toEmail: user.email,
        toName: fanName,
        creatorName,
        amountCents: subscriptionPriceCents,
        nextBillingDate,
        cancelUrl: `${SITE_URL}/subscriptions`,
      });
    } catch (emailErr) {
      console.error("[api/subscribe] email send error (non-fatal):", emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api] subscribe error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
