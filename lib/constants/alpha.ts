/**
 * Pre-Payment Alpha phase constants.
 *
 * While the platform is in Alpha (no in-app fiat payments), creators who
 * complete KYC are automatically granted Founding Creator status:
 * permanent badge + 0% platform commission window when Beta payments launch
 * (base months, extendable via referrals, hard cap).
 *
 * Flip ALPHA_PHASE=false in the environment when Beta starts to stop
 * auto-granting.
 */

export function isAlphaPhase(): boolean {
  return process.env.ALPHA_PHASE !== "false";
}

/**
 * True when in-app fiat/crypto payments are actually usable — i.e. any wallet
 * top-up path exists. This is the server-side mirror of the client-side
 * `WALLET_PATH_ACTIVE` flag in `components/paywall-modal.tsx` and the
 * `isMockRechargeAllowed()` gate in `app/api/wallet/recharge/route.ts`.
 *
 * During the Pre-Payment Alpha (no top-up path in production), server routes
 * that move wallet balance — /api/tip, /api/subscribe, /api/unlock — must
 * refuse to run in production so a fan can never end up owing/spending money
 * that was never actually collected. Test/dev environments (E2E, Playwright,
 * NEXT_PUBLIC_TEST_MODE, local dev) stay open so existing money-flow E2E
 * suites keep working. Once the crypto top-up side-quest ships,
 * NEXT_PUBLIC_CRYPTO_TOPUP_ENABLED=true re-opens these routes for everyone.
 */
export function isInAppPaymentsEnabled(): boolean {
  return (
    process.env.E2E === "1" ||
    process.env.PLAYWRIGHT_TEST_MODE === "true" ||
    process.env.NEXT_PUBLIC_TEST_MODE === "true" ||
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_CRYPTO_TOPUP_ENABLED === "true"
  );
}

/** Base 0% commission months every Founding Creator gets in Beta. */
export const FOUNDING_BASE_COMMISSION_FREE_MONTHS = 3;

/** Every N qualified referrals extends the 0% window by 1 month. */
export const REFERRALS_PER_EXTENSION_MONTH = 5;

/** Extension cap in months (15 qualified referrals = fully maxed). */
export const MAX_REFERRAL_EXTENSION_MONTHS = 3;

/**
 * Non-cash referral incentive: every 5 qualified referrals = +1 month of
 * 0% commission in Beta, capped at +3 months.
 */
export function getReferralExtensionMonths(qualifiedCount: number): number {
  if (!Number.isFinite(qualifiedCount) || qualifiedCount <= 0) return 0;
  return Math.min(
    MAX_REFERRAL_EXTENSION_MONTHS,
    Math.floor(qualifiedCount / REFERRALS_PER_EXTENSION_MONTH)
  );
}

/** Total 0% commission months (base + earned extension). */
export function getTotalCommissionFreeMonths(qualifiedCount: number): number {
  return FOUNDING_BASE_COMMISSION_FREE_MONTHS + getReferralExtensionMonths(qualifiedCount);
}
