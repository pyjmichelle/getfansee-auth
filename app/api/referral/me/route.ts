/**
 * GET /api/referral/me
 *
 * Returns the authenticated ambassador's profile, link, and privacy-safe
 * aggregate stats.
 *
 * Auth gate: requireVerifiedCreator()
 *
 * Privacy: never exposes referred creator's earnings, email, KYC, or buyers.
 * basis_revenue_cents is never included in this response.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedCreator } from "@/lib/authz";
import { jsonError, HttpError } from "@/lib/http-errors";
import { getAmbassadorMeResponse } from "@/lib/ambassador/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { user } = await requireVerifiedCreator();

    const host =
      request.headers.get("host") ??
      process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "") ??
      "localhost:3000";

    const data = await getAmbassadorMeResponse(user.id, host);

    if (!data) {
      return NextResponse.json({ enrolled: false }, { status: 404 });
    }

    return NextResponse.json({ enrolled: true, ...data });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonError(error);
    }
    return jsonError(error);
  }
}
