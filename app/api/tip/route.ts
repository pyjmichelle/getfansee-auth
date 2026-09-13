import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { isInAppPaymentsEnabled } from "@/lib/constants/alpha";
import { spendWalletOnTip } from "@/lib/wallet-spend";
import { getRequestGeo } from "@/lib/compliance/request-geo";

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
 * Flow:
 *   1. Auth check
 *   2. Validate body and creator tip settings
 *   3. spend_wallet_on_tip — one database transaction covering the balance
 *      check, the debit, the consumption order with its commission snapshot,
 *      the creator's pending credit, the tips audit row and the transaction
 *      log. Idempotent on `idempotency_key`.
 *   4. Best-effort creator notification
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

    // 3-9. One atomic call: balance check, debit, consumption order with the
    // commission snapshot, creator pending credit, tips audit row and both
    // transaction log entries. Idempotency is enforced by the database on
    // `idempotency_key`, so a retried request cannot charge twice.
    const spend = await spendWalletOnTip({
      fanId,
      creatorId,
      postId: postId ?? null,
      amountCents,
      message: message ?? null,
      idempotencyKey: iKey,
      geo: getRequestGeo(request.headers),
    });

    if (!spend.success) {
      if (spend.insufficient) {
        return NextResponse.json(
          { success: false, error: "Insufficient balance", balance_cents: spend.balanceCents ?? 0 },
          { status: 402 }
        );
      }
      console.error("[tip] spend failed:", spend.error);
      return NextResponse.json({ success: false, error: spend.error }, { status: 500 });
    }

    if (spend.idempotent) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        tip_id: spend.tipId,
        balance_after_cents: spend.balanceAfterCents,
      });
    }

    const tipId = spend.tipId;
    const creatorNetCents = spend.creatorNetCents;

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
      balance_after_cents: spend.balanceAfterCents,
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
