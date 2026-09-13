/**
 * Stripe server-side client
 * Used for creating checkout sessions and processing webhooks.
 */
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  // Allow build to proceed without Stripe key (env may not be set in CI)
  console.warn("[stripe] STRIPE_SECRET_KEY is not set — Stripe payments will be unavailable");
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

/**
 * Master switch for the legacy Stripe fiat rail. Default OFF.
 *
 * Two independent reasons this must not be reachable:
 *
 *   1. Compliance. `create-checkout-session` has no Alpha gate, no age
 *      assurance gate and no jurisdiction gate — it will happily take card
 *      money from anywhere, including states whose age-verification statutes
 *      we would then be violating, and from fans who have never passed a
 *      check. Every other money-moving route (`/api/tip`, `/api/subscribe`,
 *      `/api/unlock`) is gated by `isInAppPaymentsEnabled()`; this one was
 *      missed.
 *   2. Correctness. The Stripe webhook credits the wallet with an
 *      application-level SELECT-then-INSERT and a read-then-write balance
 *      update. Two concurrent deliveries of the same event can both pass the
 *      duplicate check and both credit. The NowPayments path was fixed by
 *      moving this into a single atomic DB function guarded by a unique index
 *      (migration 048); Stripe never was.
 *
 * The MVP rail is PayRam, so rather than harden a path we do not intend to
 * ship, both the checkout route and the webhook refuse to run. Turning this
 * on requires fixing (2) first — see `credit_payram_deposit` in migration 051
 * for the shape the fix has to take.
 */
export function isStripeFiatEnabled(): boolean {
  return process.env.STRIPE_FIAT_ENABLED === "true";
}

/** Minimum and maximum wallet top-up amounts in USD */
export const WALLET_MIN_TOPUP_USD = 5;
export const WALLET_MAX_TOPUP_USD = 500;

/** Preset wallet top-up amounts in USD */
export const WALLET_TOPUP_PRESETS_USD = [10, 20, 50, 100] as const;
