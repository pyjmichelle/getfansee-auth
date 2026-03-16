import "server-only";

import { cookies, headers } from "next/headers";
import { getSupabaseServerClient } from "./supabase-server";
import { env } from "@/lib/env";

export type AppUser = {
  id: string;
  email: string;
};

function isRetryableAuthError(error: unknown): boolean {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message)
      : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("fetch failed") ||
    normalized.includes("econnreset") ||
    normalized.includes("socket") ||
    normalized.includes("timeout") ||
    normalized.includes("retryable")
  );
}

function isAuthSessionMissingError(error: unknown): boolean {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message)
      : String(error);
  return message.toLowerCase().includes("auth session missing");
}

async function getUserWithRetries(supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (!error) {
      return { user, error: null };
    }
    lastError = error;
    if (!isRetryableAuthError(error) || attempt === 2) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  return { user: null, error: lastError };
}

const E2E_COOKIE_LOG_WINDOW_MS = 5000;
let e2eCookieLastLoggedAt = 0;

export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await getSupabaseServerClient();
  const { user, error } = await getUserWithRetries(supabase);

  const isE2E = env.E2E === "1" || env.PLAYWRIGHT_TEST_MODE === "true";

  if ((error || !user) && isE2E) {
    const now = Date.now();
    if (now - e2eCookieLastLoggedAt >= E2E_COOKIE_LOG_WINDOW_MS) {
      e2eCookieLastLoggedAt = now;
      try {
        const cookieStore = await cookies();
        const names = cookieStore.getAll().map((c) => c.name);
        let pathInfo = "unknown";
        try {
          const h = await headers();
          const invokePath = h.get("x-invoke-path") ?? h.get("x-nextjs-matched-path");
          const referer = h.get("referer") ?? h.get("x-url") ?? "";
          if (invokePath) pathInfo = invokePath;
          else if (referer) {
            try {
              pathInfo = new URL(referer).pathname;
            } catch {
              pathInfo = referer.slice(0, 80);
            }
          }
        } catch {
          // ignore
        }
        console.warn(
          "[E2E auth] getCurrentUser null: path=" + pathInfo,
          "cookies=[" + names.join(", ") + "]"
        );
      } catch {
        // ignore
      }
    }
  }

  if (error) {
    if (!isAuthSessionMissingError(error)) {
      console.error("[auth-server] getUser error", error);
    }
    return null;
  }

  if (!user || !user.email) {
    return null;
  }

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_banned, ban_until")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      // Fail-closed: if we cannot confirm the user is not banned, deny access.
      console.error("[auth-server] Ban check query failed, denying access:", profileError.message);
      return null;
    } else if (profile) {
      const now = new Date();
      const isBanned =
        profile.is_banned || (profile.ban_until && new Date(profile.ban_until) > now);

      if (isBanned) {
        await supabase.auth.signOut();
        return null;
      }
    }
  } catch (err) {
    console.warn("[auth-server] Ban check error:", err);
  }

  return { id: user.id, email: user.email };
}

export async function ensureProfile(currentUser?: AppUser | null) {
  const supabase = await getSupabaseServerClient();
  const user = currentUser ?? (await getCurrentUser());

  if (!user) {
    console.warn("[auth-server] ensureProfile: No user found");
    return;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, age_verified, referrer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[auth-server] ensureProfile select error", error);
    return;
  }

  if (data) {
    return;
  }

  const defaultAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    user.email.split("@")[0]
  )}&background=random&color=fff&size=128`;

  const baseUsername = user.email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");
  const username = `${baseUsername}_${user.id.substring(0, 8)}`;

  const { error: insertError } = await supabase.from("profiles").insert({
    id: user.id,
    email: user.email,
    username: username,
    display_name: user.email.split("@")[0],
    role: "fan",
    age_verified: false,
    avatar_url: defaultAvatarUrl,
  });

  if (insertError) {
    console.error("[auth-server] ensureProfile insert error", insertError);
  }
}
