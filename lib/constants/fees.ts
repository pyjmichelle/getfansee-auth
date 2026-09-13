/**
 * Platform commission.
 *
 * One rate, applied to every monetisation path. Before this, tips were charged
 * 5% while subscriptions and PPV were charged nothing at all — the creator was
 * credited the full gross — which meant the "20% platform fee" in the financial
 * model existed only on paper. Three different effective rates for the same
 * business made the unit economics unverifiable and the books wrong.
 *
 * The rate here is only ever the *default*. What actually applies to a sale is
 * resolved per creator by `resolvePlatformFeeBps` and then SNAPSHOTTED onto the
 * consumption_orders row, so changing this constant never rewrites history.
 */

/** Standard platform commission, in basis points. 2000 = 20%. */
export const PLATFORM_FEE_BPS = 2000;

/**
 * Founding Creators are promised a 0% commission window when Beta payments
 * launch (see lib/constants/alpha.ts). The window end is stored per creator in
 * `profiles.commission_free_until` because it starts at Beta launch, not at
 * KYC time, and is extended by referrals.
 */
export const FOUNDING_CREATOR_FEE_BPS = 0;

export interface CreatorFeeContext {
  /** profiles.commission_free_until — ISO string or null. */
  commissionFreeUntil?: string | null;
}

/**
 * The commission rate that applies to a sale for this creator, right now.
 * Callers must pass the result to `spend_wallet` so it is recorded with the
 * order rather than recomputed later against whatever the rate has become.
 */
export function resolvePlatformFeeBps(
  creator: CreatorFeeContext | null | undefined,
  now: Date = new Date()
): number {
  const until = creator?.commissionFreeUntil;
  if (until) {
    const expiry = new Date(until);
    if (!Number.isNaN(expiry.getTime()) && expiry > now) {
      return FOUNDING_CREATOR_FEE_BPS;
    }
  }
  return PLATFORM_FEE_BPS;
}

/** Platform fee in cents for a gross amount at a given rate, rounded to cent. */
export function computePlatformFeeCents(
  grossCents: number,
  feeBps: number = PLATFORM_FEE_BPS
): number {
  return Math.round((grossCents * feeBps) / 10_000);
}

/** What the creator receives after the platform fee. */
export function computeCreatorNetCents(
  grossCents: number,
  feeBps: number = PLATFORM_FEE_BPS
): number {
  return grossCents - computePlatformFeeCents(grossCents, feeBps);
}

/**
 * @deprecated Tips are charged the standard platform rate. Kept as an alias so
 * the tip UI and the tip route keep compiling; prefer PLATFORM_FEE_BPS.
 */
export const PLATFORM_TIP_FEE_BPS = PLATFORM_FEE_BPS;

/** @deprecated Use `computePlatformFeeCents`. */
export function computeTipPlatformFeeCents(amountCents: number): number {
  return computePlatformFeeCents(amountCents, PLATFORM_FEE_BPS);
}

/** @deprecated Use `computeCreatorNetCents`. */
export function computeTipCreatorNetCents(amountCents: number): number {
  return computeCreatorNetCents(amountCents, PLATFORM_FEE_BPS);
}
