/**
 * POST /api/referral/enroll
 *
 * Enroll the authenticated verified creator as an ambassador.
 * Idempotent: calling multiple times returns the same profile.
 *
 * Auth gate: requireVerifiedCreator() — 401 if not logged in,
 *            403 if not a KYC-verified creator.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedCreator } from "@/lib/authz";
import { jsonError } from "@/lib/http-errors";
import { HttpError } from "@/lib/http-errors";
import { enrollAmbassador } from "@/lib/ambassador/server";
import { env } from "@/lib/env";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { user } = await requireVerifiedCreator();

    const profile = await enrollAmbassador(user.id);

    const host =
      request.headers.get("host") ??
      env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "") ??
      "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    const link = `${protocol}://${host}/r/${profile.referral_code}`;

    return NextResponse.json({
      code: profile.referral_code,
      link,
      status: profile.status,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonError(error);
    }
    if (error instanceof Error && error.message === "PROGRAM_DISABLED") {
      return NextResponse.json(
        { error: "PROGRAM_DISABLED", message: "Ambassador program is currently disabled" },
        { status: 403 }
      );
    }
    return jsonError(error);
  }
}
