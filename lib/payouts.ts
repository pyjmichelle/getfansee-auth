/**
 * Creator withdrawal wrappers.
 *
 * Money leaves the platform only after an admin records the off-platform
 * transfer. The request itself is atomic in `request_withdrawal`: the wallet
 * debit and the negative ledger row commit together so two concurrent requests
 * cannot overdraw. Approving must not move the ledger row out of `available`
 * — see migrations/056.
 */

import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { MINIMUM_PAYOUT_CENTS } from "@/lib/constants/fees";

export const PAYOUT_RAILS = ["payram_crypto", "paxum"] as const;
export type PayoutRail = (typeof PAYOUT_RAILS)[number];

export interface PayoutMethod {
  id: string;
  creator_id: string;
  rail: PayoutRail;
  destination: string;
  label: string | null;
  is_default: boolean;
  verified_at: string | null;
  created_at: string;
}

export interface WithdrawalRequest {
  id: string;
  creator_id: string;
  amount_cents: number;
  fee_cents: number;
  net_cents: number;
  method_id: string;
  status: "requested" | "paid" | "rejected" | "cancelled";
  creator_ledger_id: string | null;
  payout_batch_id: string | null;
  external_reference: string | null;
  reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  method?: Pick<PayoutMethod, "rail" | "destination" | "label"> | null;
}

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidPayoutDestination(rail: PayoutRail, destination: string): boolean {
  if (rail === "payram_crypto") return EVM_ADDRESS.test(destination.trim());
  return EMAIL.test(destination.trim());
}

export function isValidPayoutRail(value: unknown): value is PayoutRail {
  return typeof value === "string" && (PAYOUT_RAILS as readonly string[]).includes(value);
}

export async function getCreatorWalletBalances(creatorId: string): Promise<{
  availableCents: number;
  pendingCents: number;
}> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("wallet_accounts")
    .select("available_balance_cents, pending_balance_cents")
    .eq("user_id", creatorId)
    .maybeSingle();

  return {
    availableCents: data?.available_balance_cents ?? 0,
    pendingCents: data?.pending_balance_cents ?? 0,
  };
}

export async function isVerifiedCreatorProfile(creatorId: string): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("role, is_verified, age_verified")
    .eq("id", creatorId)
    .maybeSingle();

  if (!data || data.role !== "creator") return false;
  return data.is_verified === true || data.age_verified === true;
}

export async function listPayoutMethods(creatorId: string): Promise<PayoutMethod[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("creator_payout_methods")
    .select("id, creator_id, rail, destination, label, is_default, verified_at, created_at")
    .eq("creator_id", creatorId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[payouts] listPayoutMethods failed:", error);
    return [];
  }
  return (data ?? []) as PayoutMethod[];
}

export async function addPayoutMethod(params: {
  creatorId: string;
  rail: PayoutRail;
  destination: string;
  label?: string | null;
  isDefault?: boolean;
}): Promise<{ method: PayoutMethod } | { error: string }> {
  const destination = params.destination.trim();
  if (!isValidPayoutDestination(params.rail, destination)) {
    return {
      error:
        params.rail === "payram_crypto"
          ? "Enter a valid 0x wallet address"
          : "Enter a valid Paxum email",
    };
  }

  const admin = getSupabaseAdminClient();
  const makeDefault = params.isDefault !== false;

  if (makeDefault) {
    await admin
      .from("creator_payout_methods")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("creator_id", params.creatorId);
  }

  const { data, error } = await admin
    .from("creator_payout_methods")
    .insert({
      creator_id: params.creatorId,
      rail: params.rail,
      destination,
      label: params.label?.trim() || null,
      is_default: makeDefault,
    })
    .select("id, creator_id, rail, destination, label, is_default, verified_at, created_at")
    .single();

  if (error || !data) {
    console.error("[payouts] addPayoutMethod failed:", error);
    return { error: "Could not save the payout method" };
  }
  return { method: data as PayoutMethod };
}

export async function listWithdrawals(creatorId: string, limit = 50): Promise<WithdrawalRequest[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("withdrawal_requests")
    .select(
      "id, creator_id, amount_cents, fee_cents, net_cents, method_id, status, creator_ledger_id, payout_batch_id, external_reference, reason, decided_by, decided_at, created_at"
    )
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[payouts] listWithdrawals failed:", error);
    return [];
  }
  return (data ?? []) as WithdrawalRequest[];
}

export async function listPendingWithdrawals(limit = 50): Promise<WithdrawalRequest[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("withdrawal_requests")
    .select(
      "id, creator_id, amount_cents, fee_cents, net_cents, method_id, status, creator_ledger_id, payout_batch_id, external_reference, reason, decided_by, decided_at, created_at, creator_payout_methods(rail, destination, label)"
    )
    .eq("status", "requested")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[payouts] listPendingWithdrawals failed:", error);
    return [];
  }

  return ((data ?? []) as Array<WithdrawalRequest & { creator_payout_methods?: unknown }>).map(
    (row) => {
      const joined = row.creator_payout_methods as
        | Pick<PayoutMethod, "rail" | "destination" | "label">
        | Pick<PayoutMethod, "rail" | "destination" | "label">[]
        | null;
      const method = Array.isArray(joined) ? (joined[0] ?? null) : (joined ?? null);
      return {
        id: row.id,
        creator_id: row.creator_id,
        amount_cents: row.amount_cents,
        fee_cents: row.fee_cents,
        net_cents: row.net_cents,
        method_id: row.method_id,
        status: row.status,
        creator_ledger_id: row.creator_ledger_id,
        payout_batch_id: row.payout_batch_id,
        external_reference: row.external_reference,
        reason: row.reason,
        decided_by: row.decided_by,
        decided_at: row.decided_at,
        created_at: row.created_at,
        method,
      };
    }
  );
}

interface WithdrawalRpcResult {
  success?: boolean;
  error?: string;
  idempotent?: boolean;
  request_id?: string;
  status?: string;
  amount_cents?: number;
  balance_cents?: number;
  payout_batch_id?: string;
}

export async function requestWithdrawal(params: {
  creatorId: string;
  methodId: string;
  amountCents: number;
  idempotencyKey: string;
}): Promise<
  | {
      success: true;
      idempotent: boolean;
      requestId: string;
      status: string;
      amountCents: number;
      balanceCents?: number;
    }
  | { success: false; error: string; insufficient?: boolean; balanceCents?: number }
> {
  if (params.amountCents < MINIMUM_PAYOUT_CENTS) {
    return { success: false, error: `Minimum withdrawal is $${MINIMUM_PAYOUT_CENTS / 100}` };
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("request_withdrawal", {
    p_creator_id: params.creatorId,
    p_method_id: params.methodId,
    p_amount_cents: params.amountCents,
    p_idempotency_key: params.idempotencyKey,
  });

  if (error) {
    console.error("[payouts] request_withdrawal failed:", error);
    return { success: false, error: "Withdrawal failed" };
  }

  const result = (data ?? {}) as WithdrawalRpcResult;
  if (result.success !== true) {
    return {
      success: false,
      error: result.error ?? "Withdrawal failed",
      insufficient: result.error === "Insufficient balance",
      balanceCents: result.balance_cents,
    };
  }

  return {
    success: true,
    idempotent: result.idempotent === true,
    requestId: result.request_id ?? "",
    status: result.status ?? "requested",
    amountCents: result.amount_cents ?? params.amountCents,
    balanceCents: result.balance_cents,
  };
}

export async function decideWithdrawal(params: {
  requestId: string;
  decision: "paid" | "rejected";
  externalReference?: string;
  reason: string;
  adminId: string;
}): Promise<
  | { success: true; idempotent: boolean; requestId: string; status: string }
  | { success: false; error: string }
> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("decide_withdrawal", {
    p_request_id: params.requestId,
    p_decision: params.decision,
    p_external_reference: params.externalReference ?? null,
    p_reason: params.reason,
    p_admin_id: params.adminId,
  });

  if (error) {
    console.error("[payouts] decide_withdrawal failed:", error);
    return { success: false, error: "Could not update the withdrawal" };
  }

  const result = (data ?? {}) as WithdrawalRpcResult;
  if (result.success !== true) {
    return { success: false, error: result.error ?? "Could not update the withdrawal" };
  }

  return {
    success: true,
    idempotent: result.idempotent === true,
    requestId: result.request_id ?? params.requestId,
    status: result.status ?? params.decision,
  };
}
