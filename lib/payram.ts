import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { isPayramConfigured } from "@/lib/payments-live";

/**
 * PayRam — self-hosted crypto payment rail.
 *
 * We run the PayRam node ourselves on our own VPS and hold the cold-wallet
 * keys, so there is no processor who can freeze funds or decide our industry is
 * unacceptable after onboarding. The fan buys USDC with a card through a
 * third-party onramp into their own wallet, then pays us from it.
 *
 * SINGLE ASSET, SINGLE NETWORK: USDC on Base, hard-coded. The card onramp only
 * produces USDC/ETH on Base, and every additional asset or chain multiplies the
 * confirmation semantics, the reconciliation series and the number of keys that
 * must never leak — for no extra revenue.
 *
 * WHO PAYS THE ONRAMP FEE: the customer. Onramp funds land in the customer's
 * own self-custodial wallet and they then pay us from it, so the 3–5% is
 * charged to them by the onramp partner and never touches our books. That makes
 * the fan's real cost of a $20 top-up roughly $21, which must be disclosed on
 * the top-up screen rather than discovered at checkout.
 *
 * Flags:
 *   PAYRAM_ENABLED         — master switch, default OFF. Routes 503 unless "true".
 *   PAYRAM_BASE_URL        — our self-hosted instance.
 *   PAYRAM_API_KEY         — project API key; also the webhook HMAC key by default.
 *   PAYRAM_WEBHOOK_SECRET  — separate signing key, if configured.
 */

export const PAYRAM_CURRENCY = "USDC";
export const PAYRAM_NETWORK = "BASE";

/**
 * Fixed top-up tiers in USD.
 *
 * Not free-form, and not per-purchase. The card onramp has a minimum around
 * $20 while a PPV post costs $1.99, so charging per item is arithmetically
 * impossible on this rail — the fan tops up a balance and spends from it.
 */
export const PAYRAM_TOPUP_TIERS_USD = [20, 50, 100] as const;
export type PayramTopupTier = (typeof PAYRAM_TOPUP_TIERS_USD)[number];

export function isPayramEnabled(): boolean {
  return isPayramConfigured();
}

export function isValidTopupTier(amountUsd: unknown): amountUsd is PayramTopupTier {
  return (
    typeof amountUsd === "number" &&
    (PAYRAM_TOPUP_TIERS_USD as readonly number[]).includes(amountUsd)
  );
}

/** States PayRam reports for a payment. Only the terminal ones may credit. */
export const PAYRAM_STATES = [
  "OPEN",
  "PARTIALLY_FILLED",
  "FILLED",
  "OVER_FILLED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type PayramState = (typeof PAYRAM_STATES)[number];

/**
 * FILLED and OVER_FILLED are the only states that mean the money is ours.
 *
 * PARTIALLY_FILLED deliberately does not credit. Deciding in code whether a
 * short payment is "close enough" either loses the fan money or silently gifts
 * it, and either way the ledger stops balancing — so it is recorded and left
 * for a human.
 */
export const PAYRAM_TERMINAL_CREDIT_STATES: readonly PayramState[] = ["FILLED", "OVER_FILLED"];

/**
 * Extracts the fill state from a webhook body, or null if it is not one PayRam
 * documents.
 *
 * This exists as its own function because getting it wrong is silent. PayRam
 * sends the state as `status`; reading any other key yields `undefined`, the
 * delivery is discarded as an unknown state, and deposits never credit — with
 * no error anywhere. A seam that can be tested directly is the only way that
 * failure mode stays caught by the suite instead of by a fan who paid us.
 */
export function resolvePayramState(payload: { status?: unknown }): PayramState | null {
  const { status } = payload;
  if (typeof status !== "string") return null;
  return (PAYRAM_STATES as readonly string[]).includes(status) ? (status as PayramState) : null;
}

export interface PayramCreatePaymentResponse {
  /** PayRam's identifier for the payment. Our sole idempotency key. */
  reference_id: string;
  /** Hosted page the fan is sent to. */
  url?: string;
  host?: string;
}

/**
 * The payment webhook body.
 *
 * The fill state arrives as `status`, not `state`. PayRam uses `state` nowhere
 * in this payload, so reading the wrong key does not fail loudly — it yields
 * `undefined`, the delivery is discarded as an unknown state, and deposits
 * silently never credit. Hence the field name is load-bearing.
 *
 * Amounts are JSON strings, and `filled_amount_in_usd` is null until an
 * on-chain deposit is detected.
 */
export interface PayramWebhookPayload {
  reference_id: string;
  status: PayramState;
  /** Authoritative amount actually received, in USD. */
  filled_amount_in_usd?: number | string | null;
  /** Requested amount, denominated in `currency` rather than USD. */
  amount?: number | string;
  invoice_id?: string;
  currency?: string;
  network?: string;
  customer_id?: string;
  /** Confirmation progress while a deposit is still confirming; 0 when final. */
  confirmation_current?: number;
  confirmation_required?: number;
}

function getBaseUrl(): string {
  const base = process.env.PAYRAM_BASE_URL;
  if (!base) throw new Error("PAYRAM_BASE_URL is not configured");
  return base.replace(/\/+$/, "");
}

function getApiKey(): string {
  const key = process.env.PAYRAM_API_KEY;
  if (!key) throw new Error("PAYRAM_API_KEY is not configured");
  return key;
}

/**
 * POST {BASE_URL}/api/v1/payment
 *
 * `invoiceID` carries our own order reference so a payment can be traced back
 * to us from PayRam's side; `reference_id` in the response is PayRam's own id
 * and is what the webhook will echo.
 *
 * `customerEmail` and `customerID` are both required by the API. There is no
 * `redirectURL` parameter — where the fan lands after paying is configured once
 * on the PayRam instance, not per payment.
 *
 * `currency` + `network` are sent together to pin the payment to USDC on Base.
 * Omitting them would let the fan pick any asset the instance has enabled,
 * which is the one thing the single-asset lock exists to prevent.
 */
export async function createPayramPayment(params: {
  amountUsd: number;
  invoiceId: string;
  customerId: string;
  customerEmail: string;
}): Promise<PayramCreatePaymentResponse> {
  const res = await fetch(`${getBaseUrl()}/api/v1/payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "API-Key": getApiKey(),
    },
    body: JSON.stringify({
      amountInUSD: params.amountUsd,
      currency: PAYRAM_CURRENCY,
      network: PAYRAM_NETWORK,
      invoiceID: params.invoiceId,
      customerID: params.customerId,
      customerEmail: params.customerEmail,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayRam payment creation failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as PayramCreatePaymentResponse;
  if (!data.reference_id) {
    throw new Error("PayRam response is missing reference_id");
  }
  return data;
}

function getWebhookKey(): string | null {
  return process.env.PAYRAM_WEBHOOK_SECRET || process.env.PAYRAM_API_KEY || null;
}

/**
 * Verifies `X-Payram-Signature`: `sha256=` + HMAC-SHA256 over the **raw** body.
 *
 * The raw bytes matter. Re-serialising the parsed JSON produces a different
 * byte sequence for the same payload — different key order, different number
 * formatting, different unicode escaping — and the HMAC will not match. This is
 * also why none of the NowPayments verification code could be reused: that
 * provider signs a *sorted-key re-serialisation* with SHA-512, which is the
 * opposite convention.
 */
export function verifyPayramSignature(rawBody: string, signatureHeader: string | null): boolean {
  const key = getWebhookKey();
  if (!key || !signatureHeader) return false;

  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;

  const expected = createHmac("sha256", key).update(rawBody, "utf8").digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided.trim(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Parses an amount that may arrive as a number or a decimal string, into cents.
 * Returns null rather than 0 for anything unparseable — a deposit of "unknown"
 * must be refused, not credited as nothing or credited as the requested amount.
 */
export function parseUsdToCents(value: number | string | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}
