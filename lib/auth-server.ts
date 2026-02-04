import "server-only";

import { cookies, headers } from "next/headers";
import { getSupabaseServerClient } from "./supabase-server";

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

  const isE2E = process.env.E2E === "1" || process.env.PLAYWRIGHT_TEST_MODE === "true";

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
    console.error("[auth-server] getUser error", error);
    return null;
  }

  if (!user || !user.email) {
    return null;
  }

  // 检查用户是否被封禁（使用 maybeSingle 避免 406 错误）
  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_banned, ban_until")
      .eq("id", user.id)
      .maybeSingle();

    // 如果查询失败（如 RLS 限制或表结构问题），忽略封禁检查，允许用户继续
    if (profileError) {
      console.warn("[auth-server] Failed to check ban status:", profileError.message);
      // 不阻止登录，只是跳过封禁检查
    } else if (profile) {
      const now = new Date();
      const isBanned =
        profile.is_banned || (profile.ban_until && new Date(profile.ban_until) > now);

      if (isBanned) {
        // better-auth-best-practices: 被禁用户自动登出
        await supabase.auth.signOut();
        return null;
      }
    }
  } catch (err) {
    console.warn("[auth-server] Ban check error:", err);
    // 不阻止登录
  }

  return { id: user.id, email: user.email };
}

export async function ensureProfile() {
  const supabase = await getSupabaseServerClient();
  const user = await getCurrentUser();

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

  // 生成 username（从 email 生成唯一标识）
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
