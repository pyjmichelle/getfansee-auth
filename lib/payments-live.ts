/**
 * Single source of truth for whether in-app money movement is actually open.
 *
 * Funding (PayRam top-up) and spending (subscribe / unlock / tip) used to be
 * gated by two independent flags. Flipping only `PAYRAM_ENABLED` lets a fan
 * deposit real USDC they can neither spend nor withdraw. Flipping only
 * `NEXT_PUBLIC_CRYPTO_TOPUP_ENABLED` opens the paywall with no funding path.
 * Both must be on, or the test/dev override is active.
 */

export function isTestPaymentsOverride(): boolean {
  return (
    process.env.E2E === "1" ||
    process.env.PLAYWRIGHT_TEST_MODE === "true" ||
    process.env.NEXT_PUBLIC_TEST_MODE === "true" ||
    process.env.NODE_ENV === "development"
  );
}

export function isPayramConfigured(): boolean {
  return (
    process.env.PAYRAM_ENABLED === "true" &&
    !!process.env.PAYRAM_API_KEY &&
    !!process.env.PAYRAM_BASE_URL
  );
}

export function isCryptoTopupPublicFlagOn(): boolean {
  return process.env.NEXT_PUBLIC_CRYPTO_TOPUP_ENABLED === "true";
}

/**
 * True when a fan can fund a wallet AND spend from it.
 *
 * Test/dev stays open so existing money-flow suites keep working without a
 * live PayRam node. Production requires the public flag and the rail together.
 */
export function arePaymentsLive(): boolean {
  return isTestPaymentsOverride() || (isCryptoTopupPublicFlagOn() && isPayramConfigured());
}

/**
 * Hosted PayRam checkout may open only when spend is also open. Webhooks stay
 * on `isPayramConfigured()` alone so an in-flight payment can still credit
 * after the public flag is flipped off.
 */
export function isPayramCheckoutOpen(): boolean {
  return isPayramConfigured() && arePaymentsLive();
}

/**
 * Fail closed at boot when the public spend flag is on without a funding rail.
 * Skipped under the test/dev override so local/CI suites are not blocked.
 */
export function unpairedPaymentFlagsError(): string | null {
  if (!isCryptoTopupPublicFlagOn()) return null;
  if (isPayramConfigured()) return null;
  return (
    "NEXT_PUBLIC_CRYPTO_TOPUP_ENABLED=true requires PAYRAM_ENABLED=true, PAYRAM_API_KEY and PAYRAM_BASE_URL. " +
    "Funding and spending must flip together — see lib/payments-live.ts."
  );
}

export function assertPairedPaymentFlags(): void {
  if (isTestPaymentsOverride()) return;
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return;
  const message = unpairedPaymentFlagsError();
  if (message) throw new Error(message);
}
