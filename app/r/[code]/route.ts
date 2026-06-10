/**
 * GET /r/[code]
 *
 * Referral link entry point.
 *   1. Validates the referral code (active ambassador only).
 *   2. Sets the `aref` httpOnly cookie (30 days) — first-touch wins.
 *   3. Fetches the ambassador's public display_name for the InvitedBanner.
 *   4. Records a 'clicked' event (best-effort, IP hashed).
 *   5. Redirects to /auth?mode=signup&invited=1[&ref_name=<name>].
 *
 * Cookie rules:
 *   - Name: `aref`  (DO NOT overload legacy `referral_code` which stores a userId)
 *   - Value: opaque code (never a userId)
 *   - httpOnly: true — server-side bind only; bind decision re-validates server-side
 *   - First-touch wins: if `aref` cookie already set, keep existing (no overwrite)
 *   - SameSite=Lax: works across referral link clicks
 *
 * Security:
 *   - Invalid / suspended codes receive a generic redirect (no enumeration signal).
 *   - IP is one-way hashed before storage; raw IP never persisted.
 *   - ref_name uses only the ambassador's public display_name; never user_id / email.
 *
 * Rate limiting: TODO Phase 3 — add edge rate limiting to prevent click fraud.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateAndGetDisplayName, recordReferralClick, hashIp } from "@/lib/ambassador/server";

const AREF_COOKIE = "aref";
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const { code } = await params;

  // Build base redirect URL — always redirect regardless of code validity (no enumeration)
  const redirectUrl = new URL("/auth", request.url);
  redirectUrl.searchParams.set("mode", "signup");
  redirectUrl.searchParams.set("invited", "1");

  // Fallback: return immediately for missing or invalid code
  if (!code) {
    return NextResponse.redirect(redirectUrl, { status: 302 });
  }

  // Validate code and fetch display_name in a single JOIN query (was 3 serial RTTs, now 1).
  const validated = await validateAndGetDisplayName(code).catch(() => null);
  if (!validated) {
    // Invalid or suspended — redirect without cookie (no enumeration signal)
    return NextResponse.redirect(redirectUrl, { status: 302 });
  }

  const { displayName } = validated;
  if (displayName) {
    redirectUrl.searchParams.set("ref_name", displayName);
  }

  const response = NextResponse.redirect(redirectUrl, { status: 302 });

  // First-touch wins: do NOT overwrite an existing aref cookie
  const existingAref = request.cookies.get(AREF_COOKIE)?.value;
  if (!existingAref) {
    response.cookies.set(AREF_COOKIE, code, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
      secure: process.env.NODE_ENV === "production",
    });
  }

  // Record click event (best-effort; never blocks redirect)
  const rawIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;

  void recordReferralClick(code, hashIp(rawIp));

  return response;
}
