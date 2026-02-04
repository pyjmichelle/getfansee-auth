"use client";

import { getSupabaseBrowserClient } from "./supabase-browser";

const supabase = getSupabaseBrowserClient();

export type AppUser = {
  id: string;
  email: string;
};

type AuthError = Error & {
  code?: string;
  error_description?: string;
};

/**
 * 获取当前登录用户
 * 使用 getSession() 而不是 getUser()，避免在没有 session 时抛出错误
 * 同时检查用户是否被封禁
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("[auth] getSession error", error);
    return null;
  }

  // Removed debug console.log - vercel-react-best-practices (use proper logger in production)

  if (!session?.user || !session.user.email) return null;

  // 检查用户是否被封禁（使用 maybeSingle 避免 406 错误）
  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_banned, ban_until")
      .eq("id", session.user.id)
      .maybeSingle();

    // 如果查询失败（如 RLS 限制），忽略封禁检查，允许用户继续
    if (profileError) {
      console.warn("[auth] Failed to check ban status:", profileError.message);
      // 不阻止登录，只是跳过封禁检查
    } else if (profile) {
      const now = new Date();
      const isBanned =
        profile.is_banned || (profile.ban_until && new Date(profile.ban_until) > now);

      if (isBanned) {
        // 登出被封禁的用户
        await supabase.auth.signOut();
        return null;
      }
    }
  } catch (err) {
    console.warn("[auth] Ban check error:", err);
    // 不阻止登录
  }

  return { id: session.user.id, email: session.user.email };
}

/**
 * 确保 profiles 中存在记录，默认 role = 'fan'
 */
export async function ensureProfile() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.warn("[auth] ensureProfile: No user found");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, age_verified, referrer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[auth] ensureProfile select error", error);
      // 不抛出错误，允许登录继续
      return;
    }

    if (!data) {
      // 归因逻辑：在用户注册时绑定推荐关系
      let referrerId: string | null = null;
      if (typeof window !== "undefined") {
        try {
          // 动态导入推荐模块（仅在客户端）
          const referral = await import("./referral");
          referrerId = referral.getReferralFromCookie();
        } catch (err) {
          // 如果导入失败，忽略推荐逻辑
          console.warn("[auth] Failed to load referral module:", err);
        }
      }

      // 生成默认头像 URL（使用 UI Avatars 服务）
      const defaultAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email.split("@")[0])}&background=random&color=fff&size=128`;

      // 生成 username（从 email 或 ID 生成唯一标识）
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
        referrer_id: referrerId, // 财务系统预留：绑定推荐人
      });

      if (insertError) {
        console.error("[auth] ensureProfile insert error", insertError);
        // 不抛出错误，允许登录继续（profile 可以在后续创建）
      } else {
        if (referrerId && typeof window !== "undefined") {
          // 绑定成功后清除 Cookie（在客户端执行）
          try {
            const referral = await import("./referral");
            referral.clearReferralCookie();
          } catch (err) {
            // 如果导入失败，忽略清除操作
            console.warn("[auth] Failed to clear referral cookie:", err);
          }
        }
      }
    }
  } catch (err) {
    console.error("[auth] ensureProfile unexpected error:", err);
    // 不抛出错误，允许登录继续
  }
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; session?: boolean }> {
  try {
    // 如果邮箱验证关闭，Supabase 会立即返回 session
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error("[auth] signUp error:", error);
      return { success: false, error: error.message };
    }

    // 检查是否立即获得了 session（邮箱验证关闭的情况）
    const hasSession = !!data?.session;
    console.log("[auth] signUp result:", { hasSession, userId: data?.user?.id });

    return { success: true, session: hasSession };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("[auth] signInWithPassword error:", error);
      // 确保错误信息被正确传递
      const authError: AuthError = new Error(error.message || "登录失败");
      authError.code = error.status ? String(error.status) : error.name;
      authError.error_description = error.message;
      throw authError;
    }

    // 登录后一定有 session，返回完整数据
    if (!data?.session) {
      console.warn("[auth] signInWithPassword: No session returned");
      throw new Error("登录成功但未返回会话，请重试");
    }

    return data;
  } catch (err: unknown) {
    // 如果是网络错误，包装成更友好的错误
    if (
      err instanceof Error &&
      (err.message.includes("Failed to fetch") || err.name === "NetworkError")
    ) {
      const networkError: AuthError = new Error("网络连接失败，请检查网络连接或稍后重试");
      networkError.code = "network_error";
      throw networkError;
    }
    throw err;
  }
}

export async function signInWithMagicLink(email: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo:
        typeof window !== "undefined" ? `${window.location.origin}/auth/verify` : undefined,
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
  try {
    if (process.env.NEXT_PUBLIC_TEST_MODE === "true") {
      return { success: false, error: "Google OAuth is disabled in test mode." };
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/auth/verify` : undefined,
      },
    });
    if (error) {
      return { success: false, error: error.message };
    }
    // OAuth 重定向开始，视为成功
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
