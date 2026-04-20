/**
 * POST /api/kyc/session
 *
 * Creates (or resumes) a Didit verification session for the current user.
 * Returns the verification URL and session token for the frontend SDK.
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { createOrResumeSession } from "@/lib/kyc/kyc-service";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const { user, profile } = await requireUser();

    const appUrl = env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const callbackUrl = `${appUrl}/creator/upgrade/kyc?verified=1`;

    let result;
    try {
      result = await createOrResumeSession(user.id, callbackUrl, profile.email);
    } catch (serviceError) {
      const msg = serviceError instanceof Error ? serviceError.message : "";
      const isInfraIssue =
        msg.includes("SERVICE_ROLE_KEY") ||
        msg.includes("relation") ||
        msg.includes("does not exist");
      if (isInfraIssue) {
        logger.error("[api/kyc/session] Infrastructure unavailable for KYC", { error: msg });
        return NextResponse.json(
          {
            success: false,
            error: "KYC service is temporarily unavailable. Please try again later.",
          },
          { status: 503 }
        );
      }
      throw serviceError;
    }

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      verificationUrl: result.verificationUrl,
      sessionToken: result.sessionToken,
      isExisting: result.isExisting,
    });
  } catch (error) {
    logger.error("[api/kyc/session] Error", error);
    return jsonError(error);
  }
}
