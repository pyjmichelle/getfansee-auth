"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Canonical browser Supabase client (@supabase/ssr).
 *
 * createBrowserClient persists the session to the standard
 * `sb-<project-ref>-auth-token` cookie (readable by the server clients and
 * middleware), making the cookie the single source of truth. It is internally
 * memoized; the module-level guard keeps a single instance per tab.
 */
let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return browserClient;
}
