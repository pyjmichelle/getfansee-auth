/**
 * POST /api/age-assurance/start
 *
 * Opens a vendor age-verification session for the caller's jurisdiction and
 * returns the hosted URL to redirect them to.
 *
 * The requested method is validated server-side against the jurisdiction: a
 * client cannot ask for facial estimation in Texas and have it accepted, but
 * can in Florida, where an anonymous option is statutorily required.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { getRequestGeo } from "@/lib/compliance/request-geo";
import { resolveJurisdiction, requiresVerifiedAssurance } from "@/lib/compliance/jurisdictions";
import { methodSatisfiesJurisdiction } from "@/lib/compliance/assurance-token";
import { hashClientIp, startVendorAgeCheck } from "@/lib/compliance/age-assurance";
import type { VendorAssuranceMethod } from "@/lib/compliance/age-assurance";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://getfansee.com";

const VENDOR_METHODS: readonly string[] = ["age_estimation", "document"];

/**
 * Only same-origin absolute paths may be used as the post-verification
 * destination; anything else is an open-redirect handed to us by the client.
 */
function sanitiseNext(value: unknown): string {
  if (typeof value !== "string") return "/home";
  if (!value.startsWith("/") || value.startsWith("//")) return "/home";
  return value;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { method, next } = (body ?? {}) as { method?: unknown; next?: unknown };

  if (typeof method !== "string" || !VENDOR_METHODS.includes(method)) {
    return NextResponse.json({ error: "Unsupported verification method" }, { status: 400 });
  }

  const geo = getRequestGeo(request.headers);
  const jurisdiction = resolveJurisdiction(geo);

  if (jurisdiction.tier === "blocked") {
    return NextResponse.json({ error: "Not available in your region" }, { status: 451 });
  }
  if (!requiresVerifiedAssurance(jurisdiction.tier)) {
    return NextResponse.json(
      { error: "Verification is not required in your region" },
      { status: 400 }
    );
  }
  if (!methodSatisfiesJurisdiction(method as VendorAssuranceMethod, jurisdiction)) {
    return NextResponse.json(
      { error: "This verification method is not accepted in your region" },
      { status: 400 }
    );
  }

  const user = await getCurrentUser().catch(() => null);

  const result = await startVendorAgeCheck({
    requiredTier: jurisdiction.tier,
    method: method as VendorAssuranceMethod,
    geo,
    ipHash: hashClientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
    userId: user?.id ?? null,
    next: sanitiseNext(next),
    siteUrl: SITE_URL,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }

  return NextResponse.json({ url: result.url });
}
