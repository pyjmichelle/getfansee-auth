/**
 * Settlement, reversal and reconciliation.
 *
 * Thin wrappers over the migration 052 functions. Every one of these moves or
 * unwinds money, so the logic lives in the database where it is one
 * transaction; this file only marshals arguments and normalises the result.
 */

import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * The hold period is defined once, next to the code that writes `available_on`.
 * It exists because a reversal after payout cannot be clawed back — it becomes
 * a debt netted against the creator's future earnings, the one settlement case
 * with no clean resolution. Seven days keeps most disputes inside the window
 * where the money is still ours to reverse.
 */
export { CREATOR_PENDING_DAYS } from "@/lib/wallet-spend";

export interface SettlementResult {
  success: boolean;
  creatorsSettled: number;
  centsSettled: number;
  entriesSettled: number;
  error?: string;
}

export async function settleMaturedEarnings(limit = 5000): Promise<SettlementResult> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("settle_matured_earnings", { p_limit: limit });

  if (error) {
    console.error("[settlement] settle_matured_earnings failed:", error);
    return {
      success: false,
      creatorsSettled: 0,
      centsSettled: 0,
      entriesSettled: 0,
      error: error.message,
    };
  }

  const r = (data ?? {}) as {
    success?: boolean;
    creators_settled?: number;
    cents_settled?: number;
    entries_settled?: number;
  };

  return {
    success: r.success === true,
    creatorsSettled: r.creators_settled ?? 0,
    centsSettled: r.cents_settled ?? 0,
    entriesSettled: r.entries_settled ?? 0,
  };
}

export interface ReversalResult {
  success: boolean;
  idempotent: boolean;
  orderId?: string;
  /**
   * Which of the three unwind paths was taken. `negative_adjustment` means the
   * creator had already been paid out, so the reversal is a debt against their
   * future earnings rather than a clawback — worth surfacing to whoever
   * approved the refund.
   */
  case?: "clawback_pending" | "clawback_available" | "negative_adjustment";
  fanBalanceCents?: number;
  error?: string;
}

export async function reverseConsumptionOrder(
  consumptionOrderId: string,
  reason: string
): Promise<ReversalResult> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("reverse_consumption_order", {
    p_consumption_order_id: consumptionOrderId,
    p_reason: reason,
  });

  if (error) {
    console.error("[settlement] reverse_consumption_order failed:", error);
    return { success: false, idempotent: false, error: error.message };
  }

  const r = (data ?? {}) as {
    success?: boolean;
    idempotent?: boolean;
    order_id?: string;
    case?: ReversalResult["case"];
    fan_balance_cents?: number;
    error?: string;
  };

  return {
    success: r.success === true,
    idempotent: r.idempotent === true,
    orderId: r.order_id,
    case: r.case,
    fanBalanceCents: r.fan_balance_cents,
    error: r.error,
  };
}

/**
 * Returns unspent balance to a fan.
 *
 * `externalReference` is the identifier of the transfer made off-platform (the
 * on-chain transaction hash, say). It is required and it is the idempotency
 * key: without it a retried request debits the balance twice against a single
 * real transfer.
 */
export async function refundUnspentBalance(params: {
  userId: string;
  amountCents: number;
  reason: string;
  externalReference: string;
}): Promise<{ success: boolean; idempotent: boolean; balanceCents?: number; error?: string }> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("refund_unspent_balance", {
    p_user_id: params.userId,
    p_amount_cents: params.amountCents,
    p_reason: params.reason,
    p_reference: params.externalReference,
  });

  if (error) {
    console.error("[settlement] refund_unspent_balance failed:", error);
    return { success: false, idempotent: false, error: error.message };
  }

  const r = (data ?? {}) as {
    success?: boolean;
    idempotent?: boolean;
    balance_cents?: number;
    error?: string;
  };

  return {
    success: r.success === true,
    idempotent: r.idempotent === true,
    balanceCents: r.balance_cents,
    error: r.error,
  };
}

export interface ReconciliationRow {
  identity: string;
  left_cents: number;
  right_cents: number;
  difference: number;
}

export interface ReconciliationReport {
  balanced: boolean;
  rows: ReconciliationRow[];
  error?: string;
}

/**
 * Runs the accounting identities.
 *
 * `balanced` is the release gate for Soft Beta: any non-zero difference must be
 * explained line by line before the loop is opened to the public. A difference
 * is not a rounding artefact — the ledger is in integer cents, so there is
 * nothing to round.
 */
export async function runReconciliation(): Promise<ReconciliationReport> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("reconciliation_report");

  if (error) {
    console.error("[settlement] reconciliation_report failed:", error);
    return { balanced: false, rows: [], error: error.message };
  }

  const rows = (data ?? []) as ReconciliationRow[];
  return { balanced: rows.every((r) => Number(r.difference) === 0), rows };
}

export async function runRevenueReport(from: Date, to: Date) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("revenue_report", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw new Error(`revenue_report failed: ${error.message}`);
  return (data ?? []) as Array<{
    kind: string;
    order_count: number;
    gross_cents: number;
    platform_fee_cents: number;
    creator_net_cents: number;
  }>;
}

export async function runNexusReport(from: Date, to: Date) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("nexus_report", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw new Error(`nexus_report failed: ${error.message}`);
  return (data ?? []) as Array<{
    country: string;
    region: string;
    order_count: number;
    gross_cents: number;
  }>;
}
