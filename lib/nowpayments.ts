import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

/**
 * NowPayments crypto top-up integration (SIDE QUEST — Pre-Payment Alpha).
 *
 * Status: sandbox validation only. Production activation is gated on written
 * confirmation from NowPayments regarding region/entity policy, adult-content
 * policy and effective fee rates (see docs/planning + Alpha plan §3.1).
 *
 * Flags:
 *   NOWPAYMENTS_ENABLED  — master switch, default OFF. All API routes return
 *                          503 unless this is exactly "true".
 *   NOWPAYMENTS_SANDBOX  — "true" targets the sandbox API host.
 *   NOWPAYMENTS_API_KEY / NOWPAYMENTS_IPN_SECRET — secrets (.env.local only).
 *
 * Architecture: crypto tops up the INTERNAL WALLET (deposits land in
 * `transactions type=deposit`), so lib/paywall.ts needs zero changes and
 * ambassador accrual picks up spending automatically.
 */

const PROD_API_BASE = "https://api.nowpayments.io/v1";
const SANDBOX_API_BASE = "https://api-sandbox.nowpayments.io/v1";

export function isNowPaymentsEnabled(): boolean {
  return process.env.NOWPAYMENTS_ENABLED === "true" && !!process.env.NOWPAYMENTS_API_KEY;
}

export function getNowPaymentsApiBase(): string {
  return process.env.NOWPAYMENTS_SANDBOX === "true" ? SANDBOX_API_BASE : PROD_API_BASE;
}

/** Allowed top-up presets in USD (crypto has multi-dollar network minimums). */
export const NOWPAYMENTS_TOPUP_PRESETS_USD = [20, 50, 100] as const;

export interface NowPaymentsInvoice {
  id: string;
  invoice_url: string;
  order_id: string;
  price_amount: string;
  price_currency: string;
}

/**
 * Create a hosted-checkout invoice.
 * https://documenter.getpostman.com/view/7907941/2s93JusNJt — Invoice API
 */
export async function createNowPaymentsInvoice(params: {
  amountUsd: number;
  orderId: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  ipnCallbackUrl: string;
}): Promise<NowPaymentsInvoice> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) throw new Error("NOWPAYMENTS_API_KEY not configured");

  const res = await fetch(`${getNowPaymentsApiBase()}/invoice`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: params.amountUsd,
      price_currency: "usd",
      order_id: params.orderId,
      order_description: params.description,
      ipn_callback_url: params.ipnCallbackUrl,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`NowPayments invoice creation failed (${res.status}): ${text}`);
  }

  return (await res.json()) as NowPaymentsInvoice;
}

/**
 * Verify the IPN signature (x-nowpayments-sig header).
 * Per NowPayments spec: HMAC-SHA512 of the JSON body with keys sorted
 * alphabetically, keyed with the IPN secret.
 */
export function verifyNowPaymentsIpnSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret || !signature) return false;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return false;
  }

  const sortedJson = JSON.stringify(sortKeysDeep(parsed));
  const expected = createHmac("sha512", secret).update(sortedJson).digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

export interface NowPaymentsIpnPayload {
  payment_id: number | string;
  payment_status: string;
  order_id?: string;
  price_amount?: number;
  price_currency?: string;
  pay_currency?: string;
  actually_paid?: number;
  outcome_amount?: number;
  invoice_id?: number | string;
}

/** Statuses that mean the money is final and the wallet may be credited. */
export const NOWPAYMENTS_FINAL_STATUSES = ["finished", "confirmed"] as const;
