import "server-only";

import { getSupabaseServerClient } from "./supabase-server";

/**
 * Profile 管理函数（服务端）
 * 处理 creator onboarding 和 profile 更新
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
      return true;
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

export async function getProfile(userId: string) {
  try {
    const supabase = await getSupabaseServerClient();
    let { data, error } = await supabase
      .from("profiles")
      .select(
        "id, role, display_name, bio, avatar_url, email, age_verified, blocked_countries, is_banned"
      )
      .eq("id", userId)
      .single();

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

export async function updatePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await getSupabaseServerClient();

    if (newPassword.length < 8) {
      console.error("[profile-server] updatePassword: password too short");
      return { success: false, error: "Password must be at least 8 characters" };
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      console.error("[profile-server] updatePassword: failed to get user", userError);
      return { success: false, error: "Unable to verify user identity" };
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    });

    if (verifyError) {
      console.error("[profile-server] updatePassword: old password verification failed");
      return { success: false, error: "Current password is incorrect" };
    }

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
