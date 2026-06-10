import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export type UpdateSessionResult = {
  /** Response carrying refreshed Set-Cookie headers. Must be returned/extended by callers. */
  response: NextResponse;
  /** Authenticated user (verified via Auth server), or null. */
  user: User | null;
  /** The request-scoped server client, reusable for follow-up queries (e.g. role checks). */
  supabase: SupabaseClient;
};

/**
 * Refreshes the Supabase auth session on every request and writes the rotated
 * cookies onto the response. This is the canonical @supabase/ssr middleware
 * pattern: without it, the access-token cookie eventually expires and the user
 * appears logged out even with a valid refresh token.
 *
 * Returns `user` from `getUser()` (network-verified) so callers can make
 * authorization decisions without re-calling the Auth server.
 */
export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run any logic between createServerClient and getUser().
  // getUser() triggers refresh-token rotation and writes new cookies via setAll.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user, supabase };
}
