import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { getRequestJurisdiction } from "@/lib/compliance/request-geo";
import { requiresVerifiedAssurance } from "@/lib/compliance/jurisdictions";
import {
  AGE_ASSURANCE_COOKIE,
  getAssuranceSecret,
  methodSatisfiesJurisdiction,
  verifyAssuranceToken,
} from "@/lib/compliance/assurance-token";

/**
 * Middleware: enforces the jurisdiction blocklist, then refreshes the Supabase
 * auth session on EVERY request (so the cookie never silently expires), then
 * enforces redirects for protected routes.
 *
 * Running on all routes (not just protected ones) is required by the
 * @supabase/ssr pattern — otherwise navigating across public pages lets the
 * access-token cookie go stale and the user appears logged out on the next
 * protected request.
 */
const USER_PROTECTED_PATHS = ["/me", "/subscriptions", "/purchases", "/notifications"];
const CREATOR_PROTECTED_PATHS = ["/creator/new-post", "/creator/studio", "/creator/onboarding"];

/**
 * Paths reachable from a blocked jurisdiction.
 *
 * `/blocked` itself must be, or the redirect loops. Webhooks originate from
 * payment/KYC providers whose egress IPs we do not control and must never be
 * geo-filtered. The legal pages stay open because a rights holder in a blocked
 * country still needs to be able to file a takedown notice or read what data
 * we hold about them.
 */
const GEO_EXEMPT_PREFIXES = [
  "/blocked",
  "/api/webhooks",
  "/api/health",
  "/dmca",
  "/privacy",
  "/terms",
  "/2257",
];

/**
 * Paths reachable before a Tier B/C visitor has passed age assurance.
 *
 * Everything else — including the landing page and the feed — sits behind the
 * check, because UK OSA and the US state statutes gate access to the content
 * itself, not merely the checkout. The verification flow, its callback and the
 * legal/company pages have to stay open or the visitor can never complete it.
 */
const AGE_CHECK_EXEMPT_PREFIXES = [
  ...GEO_EXEMPT_PREFIXES,
  "/age-check",
  "/api/age-assurance",
  "/about",
  "/acceptable-use",
  "/beta-terms",
  "/creator-rules",
  "/refund",
  "/support",
  "/faq",
];

/**
 * Vendor-backed age assurance is behind a master switch because it cannot be
 * turned on until the Didit workflows exist and the vendor has confirmed in
 * writing that its products map onto the statutorily enumerated methods (see
 * docs/planning/vendor-confirmation-requests.md). Until then Tier B/C
 * jurisdictions fall back to the self-attestation gate — the status quo.
 */
function isAgeAssuranceEnforced(): boolean {
  return process.env.AGE_ASSURANCE_ENABLED === "true";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const matchesPrefix = (prefixes: string[]) =>
    prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));

  const isApiRoute = pathname.startsWith("/api/");
  const jurisdiction = getRequestJurisdiction(request.headers);

  if (!matchesPrefix(GEO_EXEMPT_PREFIXES) && jurisdiction.tier === "blocked") {
    // API callers get a machine-readable refusal; page requests get the
    // explanation page. Redirecting an API route would hand the caller an
    // HTML body where it expects JSON.
    if (isApiRoute) {
      return NextResponse.json(
        { error: "Not available in your region", reason: jurisdiction.blockReason },
        { status: 451 }
      );
    }
    const blockedUrl = new URL("/blocked", request.url);
    if (jurisdiction.blockReason) {
      blockedUrl.searchParams.set("reason", jurisdiction.blockReason);
    }
    return NextResponse.redirect(blockedUrl);
  }

  if (
    isAgeAssuranceEnforced() &&
    requiresVerifiedAssurance(jurisdiction.tier) &&
    !matchesPrefix(AGE_CHECK_EXEMPT_PREFIXES)
  ) {
    const secret = getAssuranceSecret();
    const payload = secret
      ? await verifyAssuranceToken(request.cookies.get(AGE_ASSURANCE_COOKIE)?.value, secret)
      : null;

    // A token signed for a weaker method does not satisfy a stronger tier —
    // a facial estimate passed in the UK must not unlock Texas.
    const satisfied = payload !== null && methodSatisfiesJurisdiction(payload.m, jurisdiction);

    if (!satisfied) {
      if (isApiRoute) {
        return NextResponse.json(
          { error: "Age verification required", tier: jurisdiction.tier },
          { status: 403 }
        );
      }
      const checkUrl = new URL("/age-check", request.url);
      checkUrl.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(checkUrl);
    }
  }

  // Always refresh the session and capture the rotated-cookie response.
  const { response, user, supabase } = await updateSession(request);

  const isAdminPath = pathname.startsWith("/admin");
  const isUserProtected = USER_PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isCreatorProtected = CREATOR_PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isProtected = isAdminPath || isUserProtected || isCreatorProtected;

  // Public routes: session already refreshed, nothing else to enforce.
  if (!isProtected) {
    return response;
  }

  if (!user) {
    const loginUrl = new URL("/auth", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return redirectPreservingCookies(loginUrl, response);
  }

  // Admin routes: require the admin role (trust only app_metadata, then the
  // profiles table — never user-editable user_metadata).
  if (isAdminPath) {
    let userRole: string | null = (user.app_metadata?.role as string | undefined) ?? null;
    if (!userRole) {
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error("[middleware] fetch profile error:", profileError);
        }

        userRole = profile?.role ?? null;
      } catch (profileErr) {
        console.error("[middleware] unexpected profile check error:", profileErr);
      }
    }

    if (userRole !== "admin") {
      return redirectPreservingCookies(new URL("/home", request.url), response);
    }
  }

  // Creator routes only require login; role checks are enforced at the
  // page/API layer to avoid an extra DB query on every navigation.
  return response;
}

/**
 * Builds a redirect response that preserves the refreshed Set-Cookie headers
 * produced by updateSession. Without copying them, a session rotated during
 * this request would be lost on the redirect, forcing another refresh.
 */
function redirectPreservingCookies(url: URL, sourceResponse: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  sourceResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image files:
     * - _next/static, _next/image
     * - common static file extensions
     * - favicon / manifest / robots / sitemap
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sitemap.xml|icon.svg|apple-icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|woff|woff2|ttf|otf)$).*)",
  ],
};
