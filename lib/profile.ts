"use client";

/**
 * Profile 管理函数
 * 处理 creator onboarding 和 profile 更新
 */

import { getSupabaseBrowserClient } from "./supabase-browser";

const supabase = getSupabaseBrowserClient();

/**
 * 将用户角色设置为 creator
 * @param userId 用户 ID
 * @returns true 成功，false 失败
 */
export async function setRoleCreator(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("profiles").update({ role: "creator" }).eq("id", userId);

    if (error) {
      console.error("[profile] setRoleCreator error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[profile] setRoleCreator exception:", err);
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
      console.warn("[profile] updateCreatorProfile: no fields to update");
      return true; // 没有字段要更新，视为成功
    }

    const { error } = await supabase.from("profiles").update(updateData).eq("id", params.userId);

    if (error) {
      console.error("[profile] updateCreatorProfile error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[profile] updateCreatorProfile exception:", err);
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
    // 先尝试获取所有字段（包括 blocked_countries）
    let { data, error } = await supabase
      .from("profiles")
      .select("id, role, display_name, bio, avatar_url, email, age_verified, blocked_countries")
      .eq("id", userId)
      .single();

    // 如果 blocked_countries 字段不存在，只获取其他字段
    if (error && error.message?.includes("blocked_countries")) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("profiles")
        .select("id, role, display_name, bio, avatar_url, email, age_verified")
        .eq("id", userId)
        .single();

      if (fallbackError) {
        console.error("[profile] getProfile error:", fallbackError);
        return null;
      }

      // 添加默认值
      return {
        ...fallbackData,
        blocked_countries: null,
      };
    }

    if (error) {
      console.error("[profile] getProfile error:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[profile] getProfile exception:", err);
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
      console.warn("[profile] updateProfile: no fields to update");
      return true;
    }

    const { error } = await supabase.from("profiles").update(updateData).eq("id", userId);

    if (error) {
      console.error("[profile] updateProfile error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[profile] updateProfile exception:", err);
    return false;
  }
}

/**
 * 更新用户密码
 * @param userId 用户 ID
 * @param oldPassword 旧密码
 * @param newPassword 新密码
 * @returns true 成功，false 失败
 */
export async function updatePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<boolean> {
  try {
    // 验证新密码强度（至少 8 个字符）
    if (newPassword.length < 8) {
      console.error("[profile] updatePassword: password too short");
      return false;
    }

    // 使用 Supabase Auth API 更新密码
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error("[profile] updatePassword error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[profile] updatePassword exception:", err);
    return false;
  }
}
