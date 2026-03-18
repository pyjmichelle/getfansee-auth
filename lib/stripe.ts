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

/** Minimum and maximum wallet top-up amounts in USD */
export const WALLET_MIN_TOPUP_USD = 5;
export const WALLET_MAX_TOPUP_USD = 500;

/** Preset wallet top-up amounts in USD */
export const WALLET_TOPUP_PRESETS_USD = [10, 20, 50, 100] as const;
