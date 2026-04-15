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

    const result = await createOrResumeSession(user.id, callbackUrl, profile.email);

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
