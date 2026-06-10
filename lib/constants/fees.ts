/**
 * Platform fee constants.
 *
 * NOTE: These are PLACEHOLDER values. A platform-wide commission review will
 * unify the fee rates across all monetization features (subscriptions, PPV,
 * tips, ambassador, etc.). When that lands, only these constants change.
 */

/** Tip / buy-me-a-coffee platform fee, in basis points (500 = 5%). Placeholder. */
export const PLATFORM_TIP_FEE_BPS = 500;

/** Compute the platform fee (cents) withheld from a tip, rounded to nearest cent. */
export function computeTipPlatformFeeCents(amountCents: number): number {
  return Math.round((amountCents * PLATFORM_TIP_FEE_BPS) / 10_000);
}

/** Net amount (cents) credited to the creator after the platform tip fee. */
export function computeTipCreatorNetCents(amountCents: number): number {
  return amountCents - computeTipPlatformFeeCents(amountCents);
}
