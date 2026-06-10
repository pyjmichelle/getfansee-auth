import "server-only";

import { getCurrentUser } from "./auth-server";
import { getProfile } from "./profile-server";

/**
 * Server-rendered auth snapshot, injected into the client AuthProvider at the
 * root layout so every page knows the auth state at first render (no client
 * bootstrap fetch, no permanent skeletons).
 *
 * Shape intentionally matches the legacy `BootstrapResponse` so the
 * `getAuthBootstrap()` compatibility shim and `useAuth()` can share it.
 */
export type ServerAuthState = {
  authenticated: boolean;
  user: { id: string; email: string } | null;
  profile: {
    role: "fan" | "creator" | "admin";
    display_name: string;
    avatar_url: string | null;
  } | null;
};

export const UNAUTHENTICATED_STATE: ServerAuthState = {
  authenticated: false,
  user: null,
  profile: null,
};

export async function getServerAuthState(): Promise<ServerAuthState> {
  const user = await getCurrentUser();
  if (!user) {
    return UNAUTHENTICATED_STATE;
  }

  const profile = await getProfile(user.id);

  return {
    authenticated: true,
    user: { id: user.id, email: user.email },
    profile: profile
      ? {
          role: (profile.role || "fan") as "fan" | "creator" | "admin",
          display_name: profile.display_name || "",
          avatar_url: profile.avatar_url || null,
        }
      : null,
  };
}
