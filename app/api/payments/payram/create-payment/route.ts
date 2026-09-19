/**
 * POST /api/payments/payram/create-payment
 *
 * Opens a wallet top-up on the PayRam rail and returns the hosted payment URL.
 *
 * Four gates, in order of how much damage skipping them would do:
 *   1. Rail enabled (Phase 0 has not signed off until it is)
 *   2. Authenticated
 *   3. Jurisdiction permits payments — US only at launch, for the VAT/nexus
 *      reasons in lib/compliance/jurisdictions.ts
 *   4. Amount is one of the fixed tiers
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import {
  createPayramPayment,
  isPayramEnabled,
  isValidTopupTier,
  PAYRAM_TOPUP_TIERS_USD,
} from "@/lib/payram";
import { isPayramCheckoutOpen } from "@/lib/payments-live";
import { attachPayramReference, openPayramOrder } from "@/lib/payram-orders";
import { getRequestGeo } from "@/lib/compliance/request-geo";
import { resolveJurisdiction } from "@/lib/compliance/jurisdictions";

export async function POST(request: NextRequest) {
  try {
    if (!isPayramEnabled() || !isPayramCheckoutOpen()) {
      return NextResponse.json(
        { success: false, error: "Top-up is not available yet." },
        { status: 503 }
      );
    }

    const { user } = await requireUser();

    const geo = getRequestGeo(request.headers);
    const jurisdiction = resolveJurisdiction(geo);
    if (!jurisdiction.paymentsAllowed) {
      return NextResponse.json(
        { success: false, error: "Payments are not available in your region yet." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as { amountUsd?: unknown } | null;
    const amountUsd = body?.amountUsd;

    if (!isValidTopupTier(amountUsd)) {
      return NextResponse.json(
        {
          success: false,
          error: `Choose one of the available amounts: ${PAYRAM_TOPUP_TIERS_USD.map((t) => `$${t}`).join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Our own reference, echoed back by PayRam as invoice_id. Distinct from
    // PayRam's reference_id, which is what the webhook is keyed on.
    const invoiceId = `topup_${user.id}_${amountUsd}_${Date.now()}`;

    // The order row is written BEFORE asking PayRam for a payment, keyed on our
    // own invoice id until PayRam's reference exists. Creating the payment first
    // means a failure here leaves PayRam holding a live payment with no row
    // behind it: the webhook finds `Unknown order`, 500s on every retry, and a
    // fan who paid anyway is never credited. This way the worst case is an OPEN
    // order with no payment, which looks like — and is — an abandoned checkout.
    const opened = await openPayramOrder({
      userId: user.id,
      referenceId: invoiceId,
      amountCents: Math.round(amountUsd * 100),
      geo,
      metadata: { invoice_id: invoiceId },
    });

    if ("error" in opened) {
      return NextResponse.json({ success: false, error: opened.error }, { status: 500 });
    }

    const payment = await createPayramPayment({
      amountUsd,
      invoiceId,
      customerId: user.id,
      customerEmail: user.email,
    });

    // The webhook is keyed on PayRam's reference, so this has to land before the
    // fan can pay. If it fails we refuse the checkout rather than hand back a
    // URL whose deposit we could not credit.
    const attached = await attachPayramReference({
      orderId: opened.orderId,
      referenceId: payment.reference_id,
    });

    if ("error" in attached) {
      return NextResponse.json({ success: false, error: attached.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      url: payment.url,
      referenceId: payment.reference_id,
      orderId: opened.orderId,
    });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
