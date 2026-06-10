import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Canonical Server Component / Server Action Supabase client (@supabase/ssr).
 *
 * Reads the standard auth cookie. `setAll` is wrapped in try/catch because
 * Server Components cannot write cookies — the middleware (`updateSession`)
 * is responsible for refreshing and persisting the session cookie on every
 * request, so swallowing the error here is safe.
 */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component (cookies are read-only there).
          // Safe to ignore: middleware refreshes the session cookie.
        }
      },
    },
  });
}

export const getSupabaseServerClient = createClient;
