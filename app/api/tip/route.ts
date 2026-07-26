import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { computeTipPlatformFeeCents, computeTipCreatorNetCents } from "@/lib/constants/fees";
import { isInAppPaymentsEnabled } from "@/lib/constants/alpha";

// UUID v4 regex for simple validation (same pattern as paywall.ts)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MIN_TIP_CENTS = 100; // $1.00
const MAX_TIP_CENTS = 50_000; // $500.00

/**
 * POST /api/tip
 *
 * Fan sends a tip to a creator. A platform service fee (placeholder rate,
 * see lib/constants/fees.ts) is withheld; the net is credited to the creator's
 * pending balance. Tips are voluntary gratuities and are non-refundable.
 *
 * Body: {
 *   creatorId:   string (uuid, required)
 *   amountCents: number (int, 100–50000, required)
 *   postId?:     string (uuid, optional — tip on a specific post vs. profile tip)
 *   message?:    string (≤140 chars, optional, creator-visible only)
 *   clientNonce: string (required — caller-supplied nonce for idempotency)
 * }
 *
 * Atomic flow (mirrors unlockPost):
 *   1. Auth check
 *   2. Validate body
 *   3. Idempotency check — if tip with same key already exists, return 200
 *   4. Check fan wallet balance
 *   5. Deduct fan available_balance_cents
 *   6. Insert tips row (rollback on failure)
 *   7. Insert fan debit transaction (type: tip, status: completed)
 *   8. Insert creator credit transaction (type: tip, status: pending, available_on: +7d)
 *   9. Increment creator pending_balance_cents
 */
export async function POST(request: NextRequest) {
  try {
    // Pre-Payment Alpha: no wallet top-up path exists in production, so tipping
    // (which spends wallet balance) is disabled outside test/dev environments.
    if (!isInAppPaymentsEnabled()) {
      return NextResponse.json(
        {
          success: false,
          error: "Tipping is not available during the Alpha. Coming soon.",
        },
        { status: 403 }
      );
    }

    // 1. Auth
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const fanId = user.id;

    // 2. Parse + validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
    }

    const { creatorId, amountCents, postId, message, clientNonce, ...unknownFields } =
      body as Record<string, unknown>;

    // Reject unknown fields
    if (Object.keys(unknownFields).length > 0) {
      return NextResponse.json(
        { success: false, error: "Unknown fields in body" },
        { status: 400 }
      );
    }

    if (typeof creatorId !== "string" || !UUID_REGEX.test(creatorId)) {
      return NextResponse.json({ success: false, error: "Invalid creatorId" }, { status: 400 });
    }
    if (creatorId === fanId) {
      return NextResponse.json({ success: false, error: "Cannot tip yourself" }, { status: 400 });
    }
    if (
      typeof amountCents !== "number" ||
      !Number.isInteger(amountCents) ||
      amountCents < MIN_TIP_CENTS ||
      amountCents > MAX_TIP_CENTS
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `amountCents must be an integer between ${MIN_TIP_CENTS} and ${MAX_TIP_CENTS}`,
        },
        { status: 400 }
      );
    }
    if (postId !== undefined && (typeof postId !== "string" || !UUID_REGEX.test(postId))) {
      return NextResponse.json({ success: false, error: "Invalid postId" }, { status: 400 });
    }
    if (message !== undefined && (typeof message !== "string" || message.length > 140)) {
      return NextResponse.json(
        { success: false, error: "message must be ≤140 characters" },
        { status: 400 }
      );
    }
    if (typeof clientNonce !== "string" || clientNonce.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "clientNonce is required" },
        { status: 400 }
      );
    }

    const iKey = `tip_${fanId}_${creatorId}_${postId ?? "profile"}_${clientNonce.trim()}`;

    const admin = getSupabaseAdminClient();

    // 2b. Creator tip settings (optional row — absent means defaults / enabled)
    const { data: tipSettings } = await admin
      .from("creator_tip_settings")
      .select("enabled, thank_you_message")
      .eq("creator_id", creatorId)
      .maybeSingle();

    if (tipSettings && tipSettings.enabled === false) {
      return NextResponse.json(
        { success: false, error: "This creator is not accepting tips" },
        { status: 403 }
      );
    }

    // Platform fee (placeholder rate — see lib/constants/fees.ts)
    const platformFeeCents = computeTipPlatformFeeCents(amountCents);
    const creatorNetCents = computeTipCreatorNetCents(amountCents);

    // 3. Idempotency check
    const { data: existingTip } = await admin
      .from("tips")
      .select("id")
      .eq("idempotency_key", iKey)
      .maybeSingle();

    if (existingTip) {
      const { data: wallet } = await admin
        .from("wallet_accounts")
        .select("available_balance_cents")
        .eq("user_id", fanId)
        .maybeSingle();
      return NextResponse.json({
        success: true,
        idempotent: true,
        balance_after_cents: wallet?.available_balance_cents ?? 0,
      });
    }

    // 4. Check fan wallet balance
    const { data: fanWallet } = await admin
      .from("wallet_accounts")
      .select("available_balance_cents")
      .eq("user_id", fanId)
      .maybeSingle();

    const currentBalance = fanWallet?.available_balance_cents ?? 0;
    if (currentBalance < amountCents) {
      return NextResponse.json(
        { success: false, error: "Insufficient balance", balance_cents: currentBalance },
        { status: 402 }
      );
    }

    // 5. Deduct fan balance
    const newFanBalance = currentBalance - amountCents;
    const { error: deductError } = await admin
      .from("wallet_accounts")
      .upsert(
        { user_id: fanId, available_balance_cents: newFanBalance, pending_balance_cents: 0 },
        { onConflict: "user_id" }
      );

    if (deductError) {
      console.error("[tip] wallet deduct error", deductError);
      return NextResponse.json(
        { success: false, error: "Balance deduction failed" },
        { status: 500 }
      );
    }

    // 6. Insert tips row
    const tipInsertData: Record<string, unknown> = {
      fan_id: fanId,
      creator_id: creatorId,
      amount_cents: amountCents,
      platform_fee_cents: platformFeeCents,
      creator_net_cents: creatorNetCents,
      idempotency_key: iKey,
    };
    if (postId) tipInsertData.post_id = postId;
    if (message) tipInsertData.message = message;

    const { data: newTip, error: tipError } = await admin
      .from("tips")
      .insert(tipInsertData)
      .select("id")
      .single();

    if (tipError) {
      // Rollback balance
      await admin
        .from("wallet_accounts")
        .upsert(
          { user_id: fanId, available_balance_cents: currentBalance, pending_balance_cents: 0 },
          { onConflict: "user_id" }
        );
      console.error("[tip] tips insert error", tipError);
      return NextResponse.json({ success: false, error: "Tip recording failed" }, { status: 500 });
    }

    const tipId = newTip?.id;
    const availableOn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 7. Fan debit transaction
    await admin.from("transactions").insert({
      user_id: fanId,
      type: "tip",
      amount_cents: -amountCents,
      status: "completed",
      metadata: {
        creator_id: creatorId,
        post_id: postId ?? null,
        tip_id: tipId,
        idempotency_key: iKey,
      },
    });

    // 8. Creator pending revenue transaction (net of platform fee)
    await admin.from("transactions").insert({
      user_id: creatorId,
      type: "tip",
      amount_cents: creatorNetCents,
      status: "pending",
      available_on: availableOn,
      metadata: {
        fan_id: fanId,
        post_id: postId ?? null,
        tip_id: tipId,
        gross_amount_cents: amountCents,
        platform_fee_cents: platformFeeCents,
      },
    });

    // 9. Increment creator pending balance by the NET amount (after platform fee)
    const { data: creatorWallet } = await admin
      .from("wallet_accounts")
      .select("available_balance_cents, pending_balance_cents")
      .eq("user_id", creatorId)
      .maybeSingle();

    await admin.from("wallet_accounts").upsert(
      {
        user_id: creatorId,
        available_balance_cents: creatorWallet?.available_balance_cents ?? 0,
        pending_balance_cents: (creatorWallet?.pending_balance_cents ?? 0) + creatorNetCents,
      },
      { onConflict: "user_id" }
    );

    // 10. Notify creator (best-effort, non-blocking)
    // Net amount is what the creator actually receives after the platform fee.
    admin
      .from("notifications")
      .insert({
        user_id: creatorId,
        type: "payment",
        title: "You received a tip!",
        message: `A fan tipped you $${(amountCents / 100).toFixed(2)} (you receive $${(creatorNetCents / 100).toFixed(2)} after fees)${message ? `: "${message}"` : ""}`,
        link: postId ? `/post/${postId}` : `/me`,
      })
      .then(
        () => {
          // intentionally ignored
        },
        () => {
          // intentionally ignored
        }
      );

    return NextResponse.json({
      success: true,
      tip_id: tipId,
      balance_after_cents: newFanBalance,
      thank_you_message: tipSettings?.thank_you_message ?? null,
    });
  } catch (err: unknown) {
    console.error("[tip] POST exception", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
