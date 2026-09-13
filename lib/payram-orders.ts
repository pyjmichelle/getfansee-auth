/**
 * Database side of the PayRam rail. Kept out of the route handlers so the
 * service-role client stays inside `lib/`, and so the crediting logic has one
 * home rather than being spread across a webhook body.
 */

import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { PAYRAM_CURRENCY, PAYRAM_NETWORK } from "@/lib/payram";
import type { PayramState } from "@/lib/payram";
import type { GeoContext } from "@/lib/compliance/jurisdictions";

export async function openPayramOrder(params: {
  userId: string;
  referenceId: string;
  amountCents: number;
  geo: GeoContext | null;
  metadata?: Record<string, unknown>;
}): Promise<{ orderId: string } | { error: string }> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("open_payment_order", {
    p_user_id: params.userId,
    p_provider: "payram",
    p_reference_id: params.referenceId,
    p_amount_cents: params.amountCents,
    p_currency: PAYRAM_CURRENCY,
    p_network: PAYRAM_NETWORK,
    p_buyer_country: params.geo?.country ?? null,
    p_buyer_region: params.geo?.region ?? null,
    p_metadata: params.metadata ?? {},
  });

  if (error) {
    console.error("[payram-orders] open_payment_order failed:", error);
    return { error: "Could not record the payment order" };
  }

  const result = (data ?? {}) as { success?: boolean; order_id?: string; error?: string };
  if (result.success !== true || !result.order_id) {
    return { error: result.error ?? "Could not record the payment order" };
  }
  return { orderId: result.order_id };
}

/**
 * Re-keys an order onto PayRam's own reference once the hosted payment exists.
 *
 * The order is opened first, under our invoice id, because the reverse order
 * leaves PayRam holding a live payment for which we have no row: the webhook
 * then finds `Unknown order`, 500s on every retry, and a fan who paid is never
 * credited. Opening first means the only failure left is an order with no
 * payment attached, which is indistinguishable from an abandoned checkout.
 */
export async function attachPayramReference(params: {
  orderId: string;
  referenceId: string;
}): Promise<{ ok: true } | { error: string }> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("payment_orders")
    .update({ reference_id: params.referenceId })
    .eq("id", params.orderId);

  if (error) {
    console.error("[payram-orders] could not attach PayRam reference:", error, params);
    return { error: "Could not record the payment reference" };
  }
  return { ok: true };
}

export interface CreditResult {
  success: boolean;
  credited: boolean;
  idempotent: boolean;
  orderId?: string;
  balanceCents?: number;
  error?: string;
  reason?: string;
}

/**
 * Credits a deposit through `credit_payram_deposit`.
 *
 * All the hard parts live in the database function: the row lock that
 * serialises redelivered webhooks, the `credited_at` guard that makes the
 * second one a no-op, the currency/network match, and the rule that only
 * terminal states move money. Doing any of that here would reintroduce the
 * check-then-act race that this design exists to avoid.
 */
export async function creditPayramDeposit(params: {
  referenceId: string;
  filledCents: number | null;
  state: PayramState;
  currency?: string | null;
  network?: string | null;
}): Promise<CreditResult> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("credit_payram_deposit", {
    p_reference_id: params.referenceId,
    p_filled_cents: params.filledCents,
    p_state: params.state,
    p_currency: params.currency ?? null,
    p_network: params.network ?? null,
  });

  if (error) {
    console.error("[payram-orders] credit_payram_deposit failed:", error);
    return { success: false, credited: false, idempotent: false, error: "Credit failed" };
  }

  const result = (data ?? {}) as {
    success?: boolean;
    credited?: boolean;
    idempotent?: boolean;
    order_id?: string;
    balance_cents?: number;
    error?: string;
    reason?: string;
  };

  return {
    success: result.success === true,
    credited: result.credited === true,
    idempotent: result.idempotent === true,
    orderId: result.order_id,
    balanceCents: result.balance_cents,
    error: result.error,
    reason: result.reason,
  };
}

/** Best-effort audit row, written only after money has actually moved. */
export async function recordPayramWebhookEvent(referenceId: string, state: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  await admin
    .from("webhook_events")
    .insert({
      provider: "payram",
      event_id: `${referenceId}-${state}`,
      payload_hash: referenceId,
      status: "processed",
    })
    .then(
      () => {},
      () => {
        // Duplicate rows from redelivered webhooks are expected and harmless;
        // the financial state is already correct by this point.
      }
    );
}
