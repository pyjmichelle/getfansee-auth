/**
 * POST /api/payments/nowpayments/create-invoice
 *
 * SIDE QUEST (Pre-Payment Alpha): crypto wallet top-up via NowPayments
 * hosted checkout. Hard-disabled unless NOWPAYMENTS_ENABLED=true
 * (production activation requires written due-diligence confirmation).
 *
 * Body: { amount: 20 | 50 | 100 }  (USD preset tiers)
 * Returns: { invoice_url } to redirect the fan to the hosted checkout.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import {
  isNowPaymentsEnabled,
  createNowPaymentsInvoice,
  NOWPAYMENTS_TOPUP_PRESETS_USD,
} from "@/lib/nowpayments";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://getfansee.com";

export async function POST(request: NextRequest) {
  try {
    if (!isNowPaymentsEnabled()) {
      return NextResponse.json(
        { success: false, error: "Crypto top-ups are not available yet." },
        { status: 503 }
      );
    }

    const { user } = await requireUser();

    let body: { amount?: unknown };
    try {
      body = (await request.json()) as { amount?: unknown };
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const amount = Number(body.amount);
    if (!NOWPAYMENTS_TOPUP_PRESETS_USD.includes(amount as 20 | 50 | 100)) {
      return NextResponse.json(
        {
          success: false,
          error: `Amount must be one of: ${NOWPAYMENTS_TOPUP_PRESETS_USD.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // order_id encodes user + amount + timestamp; the IPN handler parses it.
    const orderId = `topup_${user.id}_${amount * 100}_${Date.now()}`;

    const invoice = await createNowPaymentsInvoice({
      amountUsd: amount,
      orderId,
      description: `GetFanSee wallet top-up $${amount}`,
      successUrl: `${SITE_URL}/me/wallet?topup=pending`,
      cancelUrl: `${SITE_URL}/me/wallet?topup=cancelled`,
      ipnCallbackUrl: `${SITE_URL}/api/webhooks/nowpayments`,
    });

    return NextResponse.json({ success: true, invoice_url: invoice.invoice_url });
  } catch (err: unknown) {
    console.error("[nowpayments/create-invoice] error:", err);
    return jsonError(err);
  }
}
