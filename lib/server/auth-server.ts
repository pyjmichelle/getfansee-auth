import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getSupabaseServerClient } from "./supabase-server";
import { env } from "@/lib/env";
import { bindAmbassadorAttribution } from "@/lib/ambassador/bind";

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

// React.cache() dedupes calls to this function within a single request/render
// pass (e.g. root layout's getServerAuthState() + a page's own getCurrentUser()
// call previously ran the auth.getUser() + profiles ban-check query TWICE per
// request — see 2026-07-26 UI/performance audit). Same-request calls with no
// arguments always share one in-flight/resolved promise.
async function getCurrentUserUncached(): Promise<AppUser | null> {
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
    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_banned, ban_until")
      .eq("id", user.id)
      .maybeSingle();

    // One retry on transient failure before giving up — a single flaky query
    // used to fail-close the ENTIRE request (see below), which meant a brief
    // Supabase hiccup logged out every session on the page and every
    // protected route bounced them to /auth despite a perfectly valid
    // cookie. Retrying once absorbs most of that noise.
    if (profileError && isRetryableAuthError(profileError)) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const retry = await supabase
        .from("profiles")
        .select("is_banned, ban_until")
        .eq("id", user.id)
        .maybeSingle();
      profile = retry.data;
      profileError = retry.error;
    }

    if (profileError) {
      // Fail-OPEN on the ban check specifically (mirrors the client-side
      // behavior in lib/auth.ts): we could not CONFIRM the user is banned,
      // so we let a real, cookie-verified session through rather than
      // treating a transient DB error as "logged out". A confirmed ban
      // (profile.is_banned / ban_until) below still signs the user out.
      console.error(
        "[auth-server] Ban check query failed after retry, allowing session through:",
        profileError.message
      );
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

export const getCurrentUser = cache(getCurrentUserUncached);

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
    return;
  }

  // Ambassador attribution: read the httpOnly `aref` cookie and bind server-side.
  // Best-effort — never blocks or throws; signup succeeds regardless.
  try {
    const cookieStore = await cookies();
    const arefCode = cookieStore.get("aref")?.value ?? null;

    const headersStore = await headers();
    const rawIp =
      headersStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headersStore.get("x-real-ip") ??
      null;

    await bindAmbassadorAttribution(user.id, user.email, arefCode, rawIp);
  } catch (bindErr) {
    console.error("[auth-server] ensureProfile: ambassador bind error (non-fatal)", bindErr);
  }
}
