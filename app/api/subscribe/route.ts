import { NextRequest, NextResponse } from "next/server";
import { subscribe30d, isActiveSubscriber } from "@/lib/paywall";
import { getCurrentUser } from "@/lib/auth-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendSubscriptionConfirmation } from "@/lib/email";
import { isInAppPaymentsEnabled } from "@/lib/constants/alpha";
import { countSubscriptionOrders, spendWallet } from "@/lib/wallet-spend";
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
      // Re-subscribing while already inside a paid period must not reach the
      // charge at all: `subscribe30d` upserts a fresh 30-day window, so a
      // second request would extend access, and there is nothing to sell to
      // someone who already holds the period.
      if (await isActiveSubscriber(user.id, creatorId)) {
        return NextResponse.json({ success: true, alreadySubscribed: true });
      }

      // Charge before granting. Granting first looks safer per-request — worst
      // case a fan we failed to bill rather than a fan billed for nothing — but
      // it makes an unbilled grant indistinguishable from a paid one: the retry
      // hits the guard above, returns `alreadySubscribed`, and the fan keeps a
      // free window. Charging first is retry-safe in the other direction,
      // because the key below dedupes the debit while the grant re-runs.
      // The key numbers this purchase within the fan's history with this
      // creator, counted off the append-only ledger. Two concurrent requests
      // read the same count and collide on one debit; the next renewal reads a
      // higher count and pays again. The two anchors that look more natural both
      // fail: the new period end is derived from `Date.now()` inside
      // `subscribe30d`, so concurrent requests get different keys and both
      // charge; and anything read from `subscriptions` is fan-writable
      // (`subscriptions_delete_own` / `subscriptions_update_own`), so a fan can
      // walk the key back onto one they have already paid and collect a free
      // period.
      //
      // No caller-supplied `Idempotency-Key` is honoured: reusing one across
      // periods would take a free window, and it buys nothing, since retries are
      // already idempotent under the server key.
      const priorSubscriptionOrders = await countSubscriptionOrders(user.id, creatorId);
      if (priorSubscriptionOrders === null) {
        // Defaulting to 0 would reuse the first purchase's key and grant a free
        // period, so a read failure has to fail the request instead.
        return NextResponse.json(
          { success: false, error: "Could not verify purchase history. Please retry." },
          { status: 503 }
        );
      }

      const spend = await spendWallet({
        fanId: user.id,
        creatorId,
        kind: "subscription",
        grossCents: subscriptionPriceCents,
        idempotencyKey: `sub_${user.id}_${creatorId}_${priorSubscriptionOrders}`,
        referenceType: "subscription",
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

      // `subscriptions` has a runtime-resolved user column (see
      // resolveSubscriptionUserColumn), so it cannot be written from inside the
      // SQL function the way PPV and tips write `purchases` / `tips`. That
      // leaves this one window where the debit has committed and the grant has
      // not. It is a recoverable state rather than a silent one: the
      // consumption order exists, so the fan sees the charge and retrying
      // completes the grant without charging again.
      //
      // This route stays behind `isInAppPaymentsEnabled()` until the
      // subscriptions schema is normalised and this can move into a wrapper
      // alongside spend_wallet_on_ppv / spend_wallet_on_tip.
      const periodEnd = await subscribe30d(creatorId);
      if (!periodEnd) {
        console.error("[api/subscribe] charged but grant failed", {
          fanId: user.id,
          creatorId,
          consumptionOrderId: spend.consumptionOrderId,
        });
        return NextResponse.json(
          {
            success: false,
            error: "Payment went through but the subscription could not be created. Please retry.",
          },
          { status: 500 }
        );
      }
    } else {
      // Free subscription — just create the record
      const granted = await subscribe30d(creatorId);
      if (!granted) {
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
