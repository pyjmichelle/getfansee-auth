"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { invalidateAuthBootstrap } from "@/lib/auth-bootstrap-client";

/**
 * Listens to Supabase auth state changes and invalidates the bootstrap cache.
 * This ensures that after login/logout/token-refresh, all pages calling
 * getAuthBootstrap() will re-fetch the authoritative server-side session
 * rather than serving stale data.
 */
export function AuthSyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // Invalidate cached bootstrap on any meaningful auth event
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        invalidateAuthBootstrap();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return <>{children}</>;
}
