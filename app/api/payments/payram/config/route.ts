/**
 * GET /api/payments/payram/config
 *
 * Tells the client whether the crypto top-up rail is live here, and on what
 * terms. Resolved server-side per request because the answer depends on the
 * caller's jurisdiction, not only on a build-time flag — the same build serves
 * a fan in Texas who can pay and one in Berlin who cannot.
 */

import { NextRequest, NextResponse } from "next/server";
import { PAYRAM_TOPUP_TIERS_USD, PAYRAM_CURRENCY, PAYRAM_NETWORK } from "@/lib/payram";
import { isPayramCheckoutOpen } from "@/lib/payments-live";
import { getRequestJurisdiction } from "@/lib/compliance/request-geo";

export async function GET(request: NextRequest) {
  const jurisdiction = getRequestJurisdiction(request.headers);
  const railOpen = isPayramCheckoutOpen();
  const enabled = railOpen && jurisdiction.paymentsAllowed;

  return NextResponse.json({
    enabled,
    reason: enabled ? null : !railOpen ? "rail_disabled" : "region_not_supported",
    tiers: PAYRAM_TOPUP_TIERS_USD,
    currency: PAYRAM_CURRENCY,
    network: PAYRAM_NETWORK,
    /**
     * The card-to-crypto step is run by a third party who bills the fan
     * directly, so a $20 top-up costs the fan roughly $21. We never see that
     * fee, but showing it here is the difference between a disclosed cost and
     * an unpleasant surprise at the checkout page.
     */
    onrampFeePercentRange: [3, 5],
  });
}
