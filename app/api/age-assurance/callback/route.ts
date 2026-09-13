/**
 * GET /api/age-assurance/callback
 *
 * Where the verification vendor sends the visitor back to. Pulls the decision,
 * settles the evidence row, and — on a pass — issues the signed cookie that the
 * middleware gate checks.
 *
 * A "pending" decision is a real outcome for document checks that go to manual
 * review. The visitor is returned to /age-check with a status so they see an
 * honest "still reviewing" state instead of a silent redirect loop.
 */

import { NextRequest, NextResponse } from "next/server";
import { AGE_ASSURANCE_TTL_HOURS, resolveJurisdiction } from "@/lib/compliance/jurisdictions";
import { getRequestGeo } from "@/lib/compliance/request-geo";
import { methodSatisfiesJurisdiction } from "@/lib/compliance/assurance-token";
import { buildAssuranceCookie, finaliseVendorAgeCheck } from "@/lib/compliance/age-assurance";

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

  if (!checkId || !UUID_REGEX.test(checkId)) {
    return NextResponse.redirect(failureUrl("invalid"));
  }

  const { outcome, method, country } = await finaliseVendorAgeCheck(checkId);

  if (outcome !== "passed") {
    return NextResponse.redirect(failureUrl(outcome === "pending" ? "in_review" : "declined"));
  }

  // Re-resolve the jurisdiction at callback time: a method that was acceptable
  // when the session opened must still be acceptable now, otherwise a visitor
  // who moved networks mid-flow could land a weaker check than their location
  // requires.
  const jurisdiction = resolveJurisdiction(getRequestGeo(request.headers));
  if (jurisdiction.tier !== "blocked" && !methodSatisfiesJurisdiction(method, jurisdiction)) {
    return NextResponse.redirect(failureUrl("insufficient"));
  }

  const cookie = await buildAssuranceCookie({
    checkId,
    method,
    country,
    expiresAt: new Date(Date.now() + AGE_ASSURANCE_TTL_HOURS * 60 * 60 * 1000),
  });

  if (!cookie) {
    return NextResponse.redirect(failureUrl("unavailable"));
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
