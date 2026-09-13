/**
 * The single server-side entry point for spending fan wallet balance.
 *
 * Every purchase — subscription, PPV unlock, tip — goes through here and then
 * through the `spend_wallet` database function, so that:
 *
 *   * the fan debit, the consumption order, the creator's pending credit and
 *     the transaction log all commit together or not at all
 *   * the platform commission is resolved once, from one constant, and
 *     snapshotted onto the order
 *   * the buyer's jurisdiction is recorded on every sale, which is the only
 *     way a sales-tax nexus question can be answered retrospectively
 *
 * Before this, each route hand-rolled its own four-step sequence and each got
 * something different wrong: PPV and subscriptions charged no commission at
 * all, tips charged 5%, and none of the three were atomic.
 */

import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolvePlatformFeeBps } from "@/lib/constants/fees";
import type { GeoContext } from "@/lib/compliance/jurisdictions";

/** Days a creator's earnings stay pending before becoming withdrawable. */
export const CREATOR_PENDING_DAYS = 7;

export type ConsumptionKind = "subscription" | "ppv" | "tip";

export interface SpendWalletParams {
  fanId: string;
  creatorId: string;
  kind: ConsumptionKind;
  grossCents: number;
  /** Caller-derived, stable for one logical purchase. */
  idempotencyKey: string;
  referenceType?: string | null;
  referenceId?: string | null;
  geo?: GeoContext | null;
}

export type SpendWalletResult =
  | {
      success: true;
      idempotent: boolean;
      consumptionOrderId: string | null;
      balanceAfterCents: number;
      platformFeeCents: number;
      creatorNetCents: number;
      /** Set by the PPV wrapper — the row that grants access. */
      purchaseId?: string | null;
      /** Set by the tip wrapper. */
      tipId?: string | null;
      /** Set by the subscription wrapper — the row that grants access. */
      subscriptionId?: string | null;
      currentPeriodEnd?: string | null;
      /** Subscription wrapper only: the fan already held a live period. */
      alreadySubscribed?: boolean;
    }
  | { success: false; error: string; balanceCents?: number; insufficient?: boolean };

interface SpendRpcResult {
  success?: boolean;
  error?: string;
  idempotent?: boolean;
  consumption_order_id?: string;
  balance_after_cents?: number;
  balance_cents?: number;
  platform_fee_cents?: number;
  creator_net_cents?: number;
  purchase_id?: string;
  tip_id?: string;
  subscription_id?: string;
  current_period_end?: string;
  already_subscribed?: boolean;
}

/**
 * Resolves the commission rate for a creator at this instant. The caller then
 * passes it into the RPC, which snapshots it — the rate is never re-derived
 * from the database when reading history back.
 */
async function resolveFeeBpsForCreator(creatorId: string): Promise<number> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("commission_free_until")
    .eq("id", creatorId)
    .maybeSingle();

  return resolvePlatformFeeBps({
    commissionFreeUntil: (data as { commission_free_until?: string | null } | null)
      ?.commission_free_until,
  });
}

function pendingAvailableOn(): string {
  return new Date(Date.now() + CREATOR_PENDING_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function interpretSpendRpc(
  data: unknown,
  error: unknown,
  grossCents: number,
  feeBps: number,
  label: string
): SpendWalletResult {
  if (error) {
    console.error(`[wallet-spend] ${label} RPC failed:`, error);
    return { success: false, error: "Payment failed" };
  }

  const result = (data ?? {}) as SpendRpcResult;

  if (result.success !== true) {
    return {
      success: false,
      error: result.error ?? "Payment failed",
      balanceCents: result.balance_cents,
      insufficient: result.error === "Insufficient balance",
    };
  }

  const fallbackFee = Math.round((grossCents * feeBps) / 10_000);
  return {
    success: true,
    idempotent: result.idempotent === true,
    consumptionOrderId: result.consumption_order_id ?? null,
    balanceAfterCents: result.balance_after_cents ?? 0,
    platformFeeCents: result.platform_fee_cents ?? fallbackFee,
    creatorNetCents: result.creator_net_cents ?? grossCents - fallbackFee,
    purchaseId: result.purchase_id ?? null,
    tipId: result.tip_id ?? null,
    subscriptionId: result.subscription_id ?? null,
    currentPeriodEnd: result.current_period_end ?? null,
    alreadySubscribed: result.already_subscribed === true,
  };
}

export async function spendWallet(params: SpendWalletParams): Promise<SpendWalletResult> {
  const admin = getSupabaseAdminClient();
  const feeBps = await resolveFeeBpsForCreator(params.creatorId);
  const availableOn = pendingAvailableOn();

  const { data, error } = await admin.rpc("spend_wallet", {
    p_fan_id: params.fanId,
    p_creator_id: params.creatorId,
    p_kind: params.kind,
    p_gross_cents: params.grossCents,
    p_platform_fee_bps: feeBps,
    p_idempotency_key: params.idempotencyKey,
    p_reference_type: params.referenceType ?? null,
    p_reference_id: params.referenceId ?? null,
    p_buyer_country: params.geo?.country ?? null,
    p_buyer_region: params.geo?.region ?? null,
    p_available_on: availableOn,
  });

  return interpretSpendRpc(data, error, params.grossCents, feeBps, "spend_wallet");
}

/**
 * PPV unlock. Debit, commission split, creator credit and the `purchases` row
 * that grants access all commit together — see `spend_wallet_on_ppv`.
 */
export async function spendWalletOnPpv(params: {
  fanId: string;
  postId: string;
  creatorId: string;
  priceCents: number;
  idempotencyKey: string;
  geo?: GeoContext | null;
}): Promise<SpendWalletResult> {
  const admin = getSupabaseAdminClient();
  const feeBps = await resolveFeeBpsForCreator(params.creatorId);

  const { data, error } = await admin.rpc("spend_wallet_on_ppv", {
    p_fan_id: params.fanId,
    p_post_id: params.postId,
    p_creator_id: params.creatorId,
    p_price_cents: params.priceCents,
    p_platform_fee_bps: feeBps,
    p_idempotency_key: params.idempotencyKey,
    p_buyer_country: params.geo?.country ?? null,
    p_buyer_region: params.geo?.region ?? null,
    p_available_on: pendingAvailableOn(),
  });

  return interpretSpendRpc(data, error, params.priceCents, feeBps, "spend_wallet_on_ppv");
}

/** Days granted by one subscription purchase. */
export const SUBSCRIPTION_PERIOD_DAYS = 30;

/**
 * Subscription purchase. Debit, commission split, creator credit and the
 * `subscriptions` row commit together — see `spend_wallet_on_subscription`.
 *
 * The route used to charge here and write `subscriptions` separately afterwards,
 * and three review rounds of trying to pick an idempotency key that survived
 * that gap all failed: whatever the route can read to build a key is either
 * derived from the clock (differs between concurrent requests), fan-writable
 * (`subscriptions_delete_own` / `_update_own`), or changed by the charge itself.
 * The RPC removes the gap instead, and takes an advisory lock on (fan, creator)
 * so the "already subscribed" check is serialised against itself.
 *
 * `alreadySubscribed` means the fan was inside a live period and nothing was
 * charged.
 */
export async function spendWalletOnSubscription(params: {
  fanId: string;
  creatorId: string;
  priceCents: number;
  idempotencyKey: string;
  geo?: GeoContext | null;
}): Promise<SpendWalletResult> {
  const admin = getSupabaseAdminClient();
  const feeBps = await resolveFeeBpsForCreator(params.creatorId);

  const { data, error } = await admin.rpc("spend_wallet_on_subscription", {
    p_fan_id: params.fanId,
    p_creator_id: params.creatorId,
    p_price_cents: params.priceCents,
    p_platform_fee_bps: feeBps,
    p_idempotency_key: params.idempotencyKey,
    p_period_days: SUBSCRIPTION_PERIOD_DAYS,
    p_buyer_country: params.geo?.country ?? null,
    p_buyer_region: params.geo?.region ?? null,
    p_available_on: pendingAvailableOn(),
  });

  return interpretSpendRpc(data, error, params.priceCents, feeBps, "spend_wallet_on_subscription");
}

/** Tip. Same atomicity guarantee, writing the `tips` audit row. */
export async function spendWalletOnTip(params: {
  fanId: string;
  creatorId: string;
  postId?: string | null;
  amountCents: number;
  message?: string | null;
  idempotencyKey: string;
  geo?: GeoContext | null;
}): Promise<SpendWalletResult> {
  const admin = getSupabaseAdminClient();
  const feeBps = await resolveFeeBpsForCreator(params.creatorId);

  const { data, error } = await admin.rpc("spend_wallet_on_tip", {
    p_fan_id: params.fanId,
    p_creator_id: params.creatorId,
    p_post_id: params.postId ?? null,
    p_amount_cents: params.amountCents,
    p_message: params.message ?? null,
    p_platform_fee_bps: feeBps,
    p_idempotency_key: params.idempotencyKey,
    p_buyer_country: params.geo?.country ?? null,
    p_buyer_region: params.geo?.region ?? null,
    p_available_on: pendingAvailableOn(),
  });

  return interpretSpendRpc(data, error, params.amountCents, feeBps, "spend_wallet_on_tip");
}
