import { NextRequest, NextResponse } from "next/server";
import { subscribe30d, cancelSubscription } from "@/lib/paywall";
import { getCurrentUser } from "@/lib/auth-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendSubscriptionConfirmation } from "@/lib/email";
import { isInAppPaymentsEnabled } from "@/lib/constants/alpha";
import { spendWallet } from "@/lib/wallet-spend";
import { getRequestGeo } from "@/lib/compliance/request-geo";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://getfansee.com";

type SubscribePayload = {
  creatorId?: string;
  priceCents?: number;
};

export async function POST(request: NextRequest) {
  try {
    // Pre-Payment Alpha: no wallet top-up path exists in production. Block
    // subscriptions entirely here (paid AND price=0 "free" ones) — a $0
    // subscription would otherwise be a loophole that grants subscriber-only
    // access without going through the real free-follow system
    // (/api/follow). Fans should use Follow for free access during Alpha.
    if (!isInAppPaymentsEnabled()) {
      return NextResponse.json(
        {
          success: false,
          error: "In-app subscriptions are not available during the Alpha. Coming soon.",
        },
        { status: 403 }
      );
    }

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

    // 2. If subscription has a price, charge the wallet.
    if (subscriptionPriceCents > 0) {
      // The subscription record is written first because `subscriptions` has a
      // runtime-resolved user column (see resolveSubscriptionUserColumn), which
      // makes it unsafe to write from inside a SQL function the way PPV and
      // tips do. Granting before charging means the worst case is a fan with a
      // subscription we failed to bill, not a fan billed for nothing — and the
      // charge failure path cancels the grant below.
      //
      // This route stays behind `isInAppPaymentsEnabled()` until the
      // subscriptions schema is normalised and this can move into a wrapper
      // alongside spend_wallet_on_ppv / spend_wallet_on_tip.
      const granted = await subscribe30d(creatorId);
      if (!granted) {
        return NextResponse.json(
          { success: false, error: "Failed to create subscription" },
          { status: 500 }
        );
      }

      const spend = await spendWallet({
        fanId: user.id,
        creatorId,
        kind: "subscription",
        grossCents: subscriptionPriceCents,
        // One charge per fan/creator/30-day period.
        idempotencyKey: `sub_${user.id}_${creatorId}_${new Date().toISOString().slice(0, 10)}`,
        referenceType: "subscription",
        geo: getRequestGeo(request.headers),
      });

      if (!spend.success) {
        await cancelSubscription(creatorId);
        if (spend.insufficient) {
          return NextResponse.json(
            {
              success: false,
              error: "Insufficient wallet balance",
              balance_cents: spend.balanceCents ?? 0,
              required_cents: subscriptionPriceCents,
            },
            { status: 402 }
          );
        }
        console.error("[api/subscribe] spend failed:", spend.error);
        return NextResponse.json({ success: false, error: spend.error }, { status: 500 });
      }
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
