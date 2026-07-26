/**
 * POST /api/webhooks/nowpayments
 *
 * NowPayments IPN handler (SIDE QUEST — Pre-Payment Alpha).
 *
 * Security:
 * - HMAC-SHA512 signature verification (x-nowpayments-sig, sorted-key JSON)
 * - Wallet only credited on final statuses (finished/confirmed)
 *
 * Idempotency & atomicity (migrations/048_nowpayments_atomic_credit.sql):
 * NowPayments sends BOTH "confirmed" and "finished" as final statuses for the
 * SAME payment, so the crediting logic cannot dedupe on `payment_id+status`
 * (two different composite keys for one real payment) nor on an application-
 * level SELECT-then-INSERT (TOCTOU race between concurrent IPNs). Instead,
 * `credit_nowpayments_deposit` does the wallet increment + transaction insert
 * in one DB function guarded by a UNIQUE index on `payment_id` alone, so
 * Postgres — not this handler — is the single source of truth for "already
 * credited". The `webhook_events` audit row is written only AFTER the RPC
 * confirms success, so a transient failure before that point causes
 * NowPayments to retry the IPN instead of us silently losing the deposit.
 *
 * Flow: fan pays crypto on hosted checkout → IPN fires → deposit lands in
 * `transactions` and the internal wallet balance is credited. All in-platform
 * spending then reuses the existing wallet paywall path unchanged.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  isNowPaymentsEnabled,
  verifyNowPaymentsIpnSignature,
  NOWPAYMENTS_FINAL_STATUSES,
  type NowPaymentsIpnPayload,
} from "@/lib/nowpayments";

function parseOrderId(orderId: string | undefined): { userId: string; amountCents: number } | null {
  // Format: topup_<userId>_<amountCents>_<timestamp>
  if (!orderId || !orderId.startsWith("topup_")) return null;
  const parts = orderId.split("_");
  if (parts.length < 4) return null;
  const userId = parts[1];
  const amountCents = parseInt(parts[2], 10);
  if (!userId || isNaN(amountCents) || amountCents <= 0) return null;
  return { userId, amountCents };
}

/**
 * Cross-check the order_id-derived amount against the IPN's own price_amount
 * (USD) so a tampered/mismatched order_id can't credit an arbitrary amount.
 * Allow a small tolerance for rounding between dollars and cents.
 */
function amountMatchesIpn(amountCents: number, priceAmountUsd: number | undefined): boolean {
  if (priceAmountUsd === undefined || priceAmountUsd === null || Number.isNaN(priceAmountUsd)) {
    // Sandbox/older IPNs may omit price_amount — don't block on absence,
    // only on an actual mismatch we can prove.
    return true;
  }
  const expectedCents = Math.round(priceAmountUsd * 100);
  return Math.abs(expectedCents - amountCents) <= 2;
}

export async function POST(request: NextRequest) {
  if (!isNowPaymentsEnabled()) {
    return NextResponse.json({ error: "Not enabled" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-nowpayments-sig") ?? "";

  if (!verifyNowPaymentsIpnSignature(rawBody, signature)) {
    console.error("[nowpayments-webhook] Invalid IPN signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: NowPaymentsIpnPayload;
  try {
    payload = JSON.parse(rawBody) as NowPaymentsIpnPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const isFinal = (NOWPAYMENTS_FINAL_STATUSES as readonly string[]).includes(
    payload.payment_status
  );
  if (!isFinal) {
    // Intermediate statuses (waiting/confirming/partially_paid/...) — just ACK.
    // No DB writes: nothing to dedupe yet, and we don't want partial/failed
    // payment noise in the financial audit trail.
    return NextResponse.json({ received: true });
  }

  const order = parseOrderId(payload.order_id);
  if (!order) {
    console.error("[nowpayments-webhook] Unparseable order_id:", payload.order_id);
    return NextResponse.json({ received: true, ignored: true });
  }

  if (!amountMatchesIpn(order.amountCents, payload.price_amount)) {
    console.error(
      "[nowpayments-webhook] Amount mismatch: order_id implies",
      order.amountCents,
      "cents but IPN price_amount is",
      payload.price_amount,
      "USD — refusing to credit. payment_id:",
      payload.payment_id
    );
    return NextResponse.json({ received: true, ignored: true, reason: "amount_mismatch" });
  }

  // Single atomic, idempotent credit — see function comment in migration 048.
  const { data: creditResult, error: rpcError } = await admin.rpc("credit_nowpayments_deposit", {
    p_user_id: order.userId,
    p_amount_cents: order.amountCents,
    p_payment_id: String(payload.payment_id),
    p_pay_currency: payload.pay_currency ?? null,
    p_payment_status: payload.payment_status,
  });

  if (rpcError || !creditResult || (creditResult as { success?: boolean }).success !== true) {
    console.error(
      "[nowpayments-webhook] credit_nowpayments_deposit failed:",
      rpcError,
      creditResult
    );
    // Return 500 (not 200) so NowPayments retries the IPN — we have NOT
    // recorded this as processed anywhere, so a retry is safe and correct.
    return NextResponse.json({ error: "Credit failed" }, { status: 500 });
  }

  // Audit trail only — written AFTER the money movement is confirmed, so it
  // can never mask an unprocessed payment. Failures here are non-fatal
  // (duplicate rows from confirmed+finished IPNs for the same payment are
  // expected and harmless).
  await admin
    .from("webhook_events")
    .insert({
      provider: "nowpayments",
      event_id: `${payload.payment_id}-${payload.payment_status}`,
      payload_hash: String(payload.payment_id),
      status: "processed",
    })
    .then(
      () => {
        // best-effort audit log
      },
      () => {
        // duplicate or transient failure — financial state is already correct
      }
    );

  return NextResponse.json({
    received: true,
    idempotent: (creditResult as { idempotent?: boolean }).idempotent ?? false,
  });
}
