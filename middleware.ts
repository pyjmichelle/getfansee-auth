import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Middleware: refreshes the Supabase auth session on EVERY request (so the
 * cookie never silently expires), then enforces redirects for protected routes.
 *
 * Running on all routes (not just protected ones) is required by the
 * @supabase/ssr pattern — otherwise navigating across public pages lets the
 * access-token cookie go stale and the user appears logged out on the next
 * protected request.
 */
const USER_PROTECTED_PATHS = ["/me", "/subscriptions", "/purchases", "/notifications"];
const CREATOR_PROTECTED_PATHS = ["/creator/new-post", "/creator/studio", "/creator/onboarding"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
