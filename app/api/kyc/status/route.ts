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
import { getKycStatusMeta, KYC_STATUS } from "@/lib/kyc/kyc-status";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const { user } = await requireUser();

    let status;
    try {
      status = await getKycStatus(user.id);
    } catch (serviceError) {
      const msg = serviceError instanceof Error ? serviceError.message : "";
      const isInfraIssue =
        msg.includes("SERVICE_ROLE_KEY") ||
        msg.includes("relation") ||
        msg.includes("does not exist");
      if (isInfraIssue) {
        logger.warn("[api/kyc/status] Admin client or table unavailable, returning not_started", {
          error: msg,
        });
        const meta = getKycStatusMeta(KYC_STATUS.NOT_STARTED);
        return NextResponse.json({
          success: true,
          status: KYC_STATUS.NOT_STARTED,
          displayStatus: meta.label,
          message: meta.description,
          canRetry: meta.canRetry,
          canContinue: meta.canContinue,
          canStart: meta.canStartVerification,
          sessionId: null,
          verificationUrl: null,
          decidedAt: null,
        });
      }
      throw serviceError;
    }

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    logger.error("[api/kyc/status] Error", error);
    return jsonError(error);
  }
}
