/**
 * GET /api/referral/me/referrals
 *
 * Paginated list of invited creators for the ambassador dashboard.
 * Served from ambassador_referrals_safe view — privacy-safe.
 *
 * Query params:
 *   page      (default 1)
 *   page_size (default 20, max 50)
 *
 * Auth gate: requireVerifiedCreator()
 *
 * Privacy: never exposes earnings, email, KYC, buyers, risk_flags,
 *          basis_revenue_cents, or signup_ip. Only public handle/avatar
 *          + lifecycle status.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedCreator } from "@/lib/authz";
import { jsonError, HttpError } from "@/lib/http-errors";
import { getAmbassadorReferrals } from "@/lib/ambassador/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { user } = await requireVerifiedCreator();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("page_size") ?? "20", 10) || 20)
    );

    const result = await getAmbassadorReferrals(user.id, page, pageSize);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonError(error);
    }
    return jsonError(error);
  }
}
