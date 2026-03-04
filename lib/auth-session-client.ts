import type { Session } from "@supabase/supabase-js";

type SessionLike = Pick<Session, "access_token" | "refresh_token" | "expires_in">;

export async function syncSessionCookies(session: SessionLike): Promise<boolean> {
  if (!session?.access_token || !session?.refresh_token) {
    return false;
  }

  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
    }),
  });

  return response.ok;
}
