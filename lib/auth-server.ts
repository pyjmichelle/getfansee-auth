import "server-only";

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

export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await getSupabaseServerClient();
  const { user, error } = await getUserWithRetries(supabase);

  if (error) {
    // better-auth-best-practices: 不泄露详细错误信息
    console.error("[auth-server] getUser error", error);
    // 不向调用者暴露具体错误，只返回 null
    return null;
  }

  if (!user || !user.email) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, ban_until")
    .eq("id", user.id)
    .single();

  if (profile) {
    const now = new Date();
    const isBanned = profile.is_banned || (profile.ban_until && new Date(profile.ban_until) > now);

    if (isBanned) {
      // better-auth-best-practices: 被禁用户自动登出
      await supabase.auth.signOut();
      return null;
    }
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

  const { error: insertError } = await supabase.from("profiles").insert({
    id: user.id,
    email: user.email,
    display_name: user.email.split("@")[0],
    role: "fan",
    age_verified: false,
    avatar_url: defaultAvatarUrl,
  });

  if (insertError) {
    console.error("[auth-server] ensureProfile insert error", insertError);
  }
}
