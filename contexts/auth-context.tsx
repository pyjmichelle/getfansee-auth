"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { setAuthSnapshot, type BootstrapResponse } from "@/lib/auth-bootstrap-client";

export type AuthUser = { id: string; email: string } | null;
export type AuthProfile = {
  role: "fan" | "creator" | "admin";
  display_name: string;
  avatar_url: string | null;
} | null;

export type AuthState = {
  authenticated: boolean;
  user: AuthUser;
  profile: AuthProfile;
};

const DEFAULT_STATE: AuthState = { authenticated: false, user: null, profile: null };

const AuthContext = createContext<AuthState>(DEFAULT_STATE);

function toBootstrap(state: AuthState): BootstrapResponse {
  return {
    authenticated: state.authenticated,
    user: state.user ?? undefined,
    profile: state.profile,
  };
}

/**
 * AuthProvider receives the server-rendered auth state (`initialAuth`) from the
 * root layout and is the single source of truth for client-side auth.
 *
 * - Exposes `useAuth()` for components.
 * - Mirrors the state into the module-level snapshot so the legacy
 *   `getAuthBootstrap()` consumers stay in sync with ZERO network calls.
 * - Listens to Supabase auth events and calls `router.refresh()` so the server
 *   re-renders the layout with a fresh `initialAuth` (cookie is the source of
 *   truth; no manual cookie syncing).
 */
export function AuthProvider({
  initialAuth,
  children,
}: {
  initialAuth: AuthState;
  children: ReactNode;
}) {
  // Keep the non-hook snapshot in sync on every render (idempotent). Client-only
  // guard avoids writing the shared module variable during SSR (where it is
  // never read); on the client this runs during render so the snapshot is
  // available synchronously before child effects fire.
  if (typeof window !== "undefined") {
    setAuthSnapshot(toBootstrap(initialAuth));
  }

  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        // Re-run server components (layout) so initialAuth reflects the cookie.
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return <AuthContext.Provider value={initialAuth}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
