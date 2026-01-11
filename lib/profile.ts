/**
 * Profile 管理函数
 * 处理 creator onboarding 和 profile 更新
 */

import { supabase } from "./supabase-client"

/**
 * 将用户角色设置为 creator
 * @param userId 用户 ID
 * @returns true 成功，false 失败
 */
export async function setRoleCreator(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ role: "creator" })
      .eq("id", userId)

    if (error) {
      console.error("[profile] setRoleCreator error:", error)
      return false
    }

    return true
  } catch (err) {
    console.error("[profile] setRoleCreator exception:", err)
    return false
  }
}

/**
 * 更新 creator profile 信息
 * @param params 更新参数
 * @returns true 成功，false 失败
 */
export async function updateCreatorProfile(params: {
  userId: string
  display_name?: string
  bio?: string
  avatar_url?: string
}): Promise<boolean> {
  try {
    const updateData: {
      display_name?: string
      bio?: string
      avatar_url?: string
    } = {}

    if (params.display_name !== undefined) {
      updateData.display_name = params.display_name
    }
    if (params.bio !== undefined) {
      updateData.bio = params.bio
    }
    if (params.avatar_url !== undefined) {
      updateData.avatar_url = params.avatar_url
    }

    if (Object.keys(updateData).length === 0) {
      console.warn("[profile] updateCreatorProfile: no fields to update")
      return true // 没有字段要更新，视为成功
    }

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", params.userId)

    if (error) {
      console.error("[profile] updateCreatorProfile error:", error)
      return false
    }

    return true
  } catch (err) {
    console.error("[profile] updateCreatorProfile exception:", err)
    return false
  }
}

/**
 * 获取用户 profile（包含 role, display_name, bio, avatar_url）
 * @param userId 用户 ID
 * @returns profile 数据或 null
 */
export async function getProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, display_name, bio, avatar_url, email")
      .eq("id", userId)
      .single()

    if (error) {
      console.error("[profile] getProfile error:", error)
      return null
    }

    return data
  } catch (err) {
    console.error("[profile] getProfile exception:", err)
    return null
  }
}



