/**
 * POST /api/webhooks/payram
 *
 * The only path by which a fan's wallet is credited from the crypto rail.
 *
 * Security and correctness, in the order they are enforced:
 *
 *   1. HMAC-SHA256 over the RAW request body. The body is read as text and
 *      never re-serialised before verification — re-encoding parsed JSON
 *      changes the bytes and the signature would never match. This is also why
 *      the NowPayments verifier could not be reused: it signs a sorted-key
 *      re-serialisation with SHA-512, the opposite convention.
 *   2. Only FILLED / OVER_FILLED credit. PARTIALLY_FILLED is persisted and left
 *      for a human rather than guessed at.
 *   3. The received amount comes from the webhook, not from what we asked for.
 *      An overpayment belongs to the fan; crediting the requested amount would
 *      quietly turn the difference into platform income.
 *   4. Crediting is a single database function guarded by a row lock and a
 *      `credited_at` timestamp, so a redelivered webhook cannot double-credit.
 *      Redelivery is normal, not exceptional.
 *
 * Failure to credit returns 500 so PayRam retries. Nothing has been recorded as
 * processed at that point, so a retry is both safe and the desired outcome —
 * the opposite ordering (mark processed, then credit) is how a paid deposit
 * gets permanently lost.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  isPayramEnabled,
  parseUsdToCents,
  resolvePayramState,
  verifyPayramSignature,
  PAYRAM_TERMINAL_CREDIT_STATES,
  type PayramWebhookPayload,
} from "@/lib/payram";
import { creditPayramDeposit, recordPayramWebhookEvent } from "@/lib/payram-orders";

export async function POST(request: NextRequest) {
  if (!isPayramEnabled()) {
    return NextResponse.json({ error: "Not enabled" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-payram-signature");

  if (!verifyPayramSignature(rawBody, signature)) {
    console.error("[payram-webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: PayramWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as PayramWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.reference_id) {
    return NextResponse.json({ received: true, ignored: true, reason: "missing_reference_id" });
  }

  const state = resolvePayramState(payload);
  if (!state) {
    console.error("[payram-webhook] Unknown status:", payload.status);
    return NextResponse.json({ received: true, ignored: true, reason: "unknown_state" });
  }

  const isCreditable = PAYRAM_TERMINAL_CREDIT_STATES.includes(state);
  const filledCents = parseUsdToCents(payload.filled_amount_in_usd);

  // A creditable state with no readable amount must not be credited: we cannot
  // verify what arrived, and substituting the requested amount would be
  // trusting a number the payload did not confirm.
  //
  // It must not be acknowledged either. A 200 tells PayRam the delivery
  // succeeded, so it stops retrying and a deposit we were told about is never
  // credited — visible only in a log line nobody is reading. Failing keeps the
  // delivery in PayRam's retry queue and on its failed-webhook list, which is
  // where a human will actually see it.
  if (isCreditable && filledCents === null) {
    console.error(
      "[payram-webhook] Terminal state with unreadable filled_amount_in_usd — refusing to credit.",
      payload.reference_id,
      payload.filled_amount_in_usd
    );
    return NextResponse.json(
      { error: "Unreadable filled_amount_in_usd", reason: "missing_filled_amount" },
      { status: 500 }
    );
  }

  const result = await creditPayramDeposit({
    referenceId: payload.reference_id,
    filledCents,
    state,
    currency: payload.currency ?? null,
    network: payload.network ?? null,
  });

  if (!result.success) {
    console.error("[payram-webhook] credit failed:", result.error, payload.reference_id);
    return NextResponse.json({ error: result.error ?? "Credit failed" }, { status: 500 });
  }

  if (result.credited || result.idempotent) {
    await recordPayramWebhookEvent(payload.reference_id, state);
  }

  return NextResponse.json({
    received: true,
    credited: result.credited,
    idempotent: result.idempotent,
    reason: result.reason,
  });
}
