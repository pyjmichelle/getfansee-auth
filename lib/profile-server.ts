import "server-only";

import { getSupabaseServerClient } from "./supabase-server";

/**
 * Profile 管理函数（服务端）
 * 处理 creator onboarding 和 profile 更新
 */

/**
 * 将用户角色设置为 creator
 * @param userId 用户 ID
 * @returns true 成功，false 失败
 */
export async function setRoleCreator(userId: string): Promise<boolean> {
  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.from("profiles").update({ role: "creator" }).eq("id", userId);

    if (error) {
      console.error("[profile-server] setRoleCreator error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[profile-server] setRoleCreator exception:", err);
    return false;
  }
}

/**
 * 更新 creator profile 信息
 * @param params 更新参数
 * @returns true 成功，false 失败
 */
export async function updateCreatorProfile(params: {
  userId: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
}): Promise<boolean> {
  try {
    const supabase = await getSupabaseServerClient();
    const updateData: {
      display_name?: string;
      bio?: string;
      avatar_url?: string;
    } = {};

    if (params.display_name !== undefined) {
      updateData.display_name = params.display_name;
    }
    if (params.bio !== undefined) {
      updateData.bio = params.bio;
    }
    if (params.avatar_url !== undefined) {
      updateData.avatar_url = params.avatar_url;
    }

    if (Object.keys(updateData).length === 0) {
      console.warn("[profile-server] updateCreatorProfile: no fields to update");
      return true; // 没有字段要更新，视为成功
    }

    const { error } = await supabase.from("profiles").update(updateData).eq("id", params.userId);

    if (error) {
      console.error("[profile-server] updateCreatorProfile error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[profile-server] updateCreatorProfile exception:", err);
    return false;
  }
}

/**
 * 获取用户 profile（包含 role, display_name, bio, avatar_url）
 * @param userId 用户 ID
 * @returns profile 数据或 null
 */
export async function getProfile(userId: string) {
  try {
    const supabase = await getSupabaseServerClient();
    // 先尝试获取所有字段（包括 blocked_countries 和 is_banned）
    let { data, error } = await supabase
      .from("profiles")
      .select(
        "id, role, display_name, bio, avatar_url, email, age_verified, blocked_countries, is_banned"
      )
      .eq("id", userId)
      .single();

    // 如果字段不存在，只获取其他字段
    if (
      error &&
      (error.message?.includes("blocked_countries") || error.message?.includes("is_banned"))
    ) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("profiles")
        .select("id, role, display_name, bio, avatar_url, email, age_verified")
        .eq("id", userId)
        .single();

      if (fallbackError) {
        console.error("[profile-server] getProfile error:", fallbackError);
        return null;
      }

      // 添加默认值
      return {
        ...fallbackData,
        blocked_countries: null,
        is_banned: false,
      };
    }

    if (error) {
      console.error("[profile-server] getProfile error:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[profile-server] getProfile exception:", err);
    return null;
  }
}

/**
 * 更新用户 profile（通用，适用于所有用户）
 * @param userId 用户 ID
 * @param updates 更新字段
 * @returns true 成功，false 失败
 */
export async function updateProfile(
  userId: string,
  updates: {
    display_name?: string;
    bio?: string;
    avatar_url?: string;
  }
): Promise<boolean> {
  try {
    const supabase = await getSupabaseServerClient();
    const updateData: {
      display_name?: string | null;
      bio?: string | null;
      avatar_url?: string | null;
    } = {};

    if (updates.display_name !== undefined) {
      updateData.display_name = updates.display_name.trim() || null;
    }
    if (updates.bio !== undefined) {
      updateData.bio = updates.bio.trim() || null;
    }
    if (updates.avatar_url !== undefined) {
      updateData.avatar_url = updates.avatar_url || null;
    }

    if (Object.keys(updateData).length === 0) {
      console.warn("[profile-server] updateProfile: no fields to update");
      return true;
    }

    const { error } = await supabase.from("profiles").update(updateData).eq("id", userId);

    if (error) {
      console.error("[profile-server] updateProfile error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[profile-server] updateProfile exception:", err);
    return false;
  }
}

/**
 * 更新用户密码
 * P1 安全修复：必须验证旧密码后才能更新
 *
 * @param userId 用户 ID
 * @param oldPassword 旧密码
 * @param newPassword 新密码
 * @returns { success: boolean, error?: string }
 */
export async function updatePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await getSupabaseServerClient();

    // 验证新密码强度（至少 8 个字符）
    if (newPassword.length < 8) {
      console.error("[profile-server] updatePassword: password too short");
      return { success: false, error: "Password must be at least 8 characters" };
    }

    // P1 安全修复：首先获取用户邮箱
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      console.error("[profile-server] updatePassword: failed to get user", userError);
      return { success: false, error: "Unable to verify user identity" };
    }

    // P1 安全修复：使用旧密码重新登录验证身份
    // 这确保即使 session 被劫持，攻击者也无法在不知道旧密码的情况下更改密码
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    });

    if (verifyError) {
      console.error("[profile-server] updatePassword: old password verification failed");
      return { success: false, error: "Current password is incorrect" };
    }

    // 旧密码验证成功，现在更新密码
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error("[profile-server] updatePassword error:", updateError);
      return { success: false, error: "Failed to update password" };
    }

    return { success: true };
  } catch (err) {
    console.error("[profile-server] updatePassword exception:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}
