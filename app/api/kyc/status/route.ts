/**
 * GET /api/kyc/status
 *
 * Returns the current KYC verification status for the logged-in user.
 * Used by frontend to render the appropriate KYC state card.
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { getKycStatus } from "@/lib/kyc/kyc-service";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const { user } = await requireUser();
    const status = await getKycStatus(user.id);

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    logger.error("[api/kyc/status] Error", error);
    return jsonError(error);
  }
}
