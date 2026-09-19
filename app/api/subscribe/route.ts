import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendSubscriptionConfirmation } from "@/lib/email";
import { isInAppPaymentsEnabled } from "@/lib/constants/alpha";
import { spendWalletOnSubscription } from "@/lib/wallet-spend";
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

    const { creatorId } = (await request.json()) as SubscribePayload;

    if (!creatorId) {
      return NextResponse.json({ success: false, error: "creatorId is required" }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdminClient();

    // Price is authoritative on the creator profile. Ignore any client quote.
    const { data: creatorProfile } = await admin
      .from("profiles")
      .select("display_name, subscription_price_cents")
      .eq("id", creatorId)
      .maybeSingle();

    const subscriptionPriceCents = creatorProfile?.subscription_price_cents ?? 0;
    const creatorName = creatorProfile?.display_name || "Creator";
    let currentPeriodEnd: string | null = null;

    // 2. If subscription has a price, charge the wallet.
    if (subscriptionPriceCents > 0) {
      // One atomic call: the debit, the commission split, the creator credit
      // and the `subscriptions` row commit together, exactly as PPV and tips
      // already do. Charging here and writing `subscriptions` separately
      // afterwards left a gap that no idempotency key could cover — see
      // `spendWalletOnSubscription` for why each candidate key failed — so the
      // gap is gone rather than named.
      //
      // The RPC also owns the "already inside a live period" check, because that
      // check has to be serialised against itself: run from here, two in-flight
      // requests both read "not subscribed" and both charge.
      //
      // No caller-supplied `Idempotency-Key` is honoured: reusing one across
      // periods would take a free window, and it buys nothing now that the RPC
      // makes retries idempotent on its own.
      const spend = await spendWalletOnSubscription({
        fanId: user.id,
        creatorId,
        priceCents: subscriptionPriceCents,
        idempotencyKey: `sub_${user.id}_${creatorId}_${randomUUID()}`,
        geo: getRequestGeo(request.headers),
      });

      if (!spend.success) {
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

      if (spend.alreadySubscribed) {
        return NextResponse.json({ success: true, alreadySubscribed: true });
      }
      currentPeriodEnd = spend.currentPeriodEnd ?? null;
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "This creator has no paid subscription. Use Follow for free access.",
        },
        { status: 400 }
      );
    }

    // 3. Send order confirmation email (non-blocking)
    try {
      const { data: profileRes } = await admin
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      const fanName = profileRes?.display_name || user.email.split("@")[0];
      const periodEndDate = currentPeriodEnd
        ? new Date(currentPeriodEnd)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const nextBillingDate = periodEndDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

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
