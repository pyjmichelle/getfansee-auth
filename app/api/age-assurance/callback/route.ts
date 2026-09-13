/**
 * GET /api/age-assurance/callback
 *
 * Where the verification vendor sends the visitor back to. Pulls the decision,
 * settles the evidence row, and — on a pass — issues the signed cookie that the
 * middleware gate checks.
 *
 * The `check` query parameter is an identifier, not a credential: it sits in
 * browser history, in the vendor's logs, in any Referer this URL leaks into. So
 * the cookie is issued only against the one-time secret minted at /start and
 * held in an httpOnly cookie, and only if that secret has not been spent —
 * otherwise the link alone would grant the gate, repeatedly and to anyone.
 *
 * A "pending" decision is a real outcome for document checks that go to manual
 * review. The visitor is returned to /age-check with a status so they see an
 * honest "still reviewing" state instead of a silent redirect loop. The claim
 * cookie survives that case, because the check may still land as a pass.
 */

import { NextRequest, NextResponse } from "next/server";
import { AGE_ASSURANCE_TTL_HOURS, resolveJurisdiction } from "@/lib/compliance/jurisdictions";
import { getRequestGeo } from "@/lib/compliance/request-geo";
import { methodSatisfiesJurisdiction } from "@/lib/compliance/assurance-token";
import {
  AGE_CLAIM_COOKIE,
  buildAssuranceCookie,
  claimPassedAgeCheck,
  expiredAgeClaimCookie,
  finaliseVendorAgeCheck,
  readAgeClaimSecret,
} from "@/lib/compliance/age-assurance";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/home";
  return value;
}

export async function GET(request: NextRequest) {
  const checkId = request.nextUrl.searchParams.get("check");
  const next = safeNext(request.nextUrl.searchParams.get("next"));

  const failureUrl = (status: string) => {
    const url = new URL("/age-check", request.url);
    url.searchParams.set("status", status);
    url.searchParams.set("next", next);
    return url;
  };

  /** Sends the visitor back to the gate and burns the claim cookie with them. */
  const spentFailure = (status: string) => {
    const response = NextResponse.redirect(failureUrl(status));
    const cleared = expiredAgeClaimCookie();
    response.cookies.set(cleared.name, cleared.value, cleared.options);
    return response;
  };

  if (!checkId || !UUID_REGEX.test(checkId)) {
    return NextResponse.redirect(failureUrl("invalid"));
  }

  const claimSecret = readAgeClaimSecret(request.cookies.get(AGE_CLAIM_COOKIE)?.value, checkId);
  if (!claimSecret) {
    return spentFailure("invalid");
  }

  const { outcome, method, country } = await finaliseVendorAgeCheck(checkId);

  if (outcome === "pending") {
    // Keep the claim cookie: manual review may still come back a pass, and the
    // visitor returns through this same URL when it does.
    return NextResponse.redirect(failureUrl("in_review"));
  }
  if (outcome !== "passed") {
    return spentFailure("declined");
  }

  // Re-resolve the jurisdiction at callback time: a method that was acceptable
  // when the session opened must still be acceptable now, otherwise a visitor
  // who moved networks mid-flow could land a weaker check than their location
  // requires.
  const jurisdiction = resolveJurisdiction(getRequestGeo(request.headers));
  if (jurisdiction.tier !== "blocked" && !methodSatisfiesJurisdiction(method, jurisdiction)) {
    return spentFailure("insufficient");
  }

  // Mint before spending: a missing signing secret is our misconfiguration, and
  // burning the visitor's check over it would make them verify (and pay) again.
  const cookie = await buildAssuranceCookie({
    checkId,
    method,
    country,
    expiresAt: new Date(Date.now() + AGE_ASSURANCE_TTL_HOURS * 60 * 60 * 1000),
  });

  if (!cookie) {
    return NextResponse.redirect(failureUrl("unavailable"));
  }

  // Spend the check last. A second visit to this URL — with the same cookie, or
  // a copy of it — finds the row already claimed and gets nothing.
  if (!(await claimPassedAgeCheck(checkId, claimSecret))) {
    return spentFailure("invalid");
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  const cleared = expiredAgeClaimCookie();
  response.cookies.set(cleared.name, cleared.value, cleared.options);
  return response;
}
