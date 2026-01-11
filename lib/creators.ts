/**
 * Creators 数据访问层
 * Money & Access MVP
 */

import { supabase } from "./supabase-client"

export type Creator = {
  id: string
  display_name: string
  avatar_url?: string
  bio?: string
  created_at: string
}

/**
 * 获取所有 creators 列表
 * @returns Creator[] 或 null（如果查询失败）
 */
export async function listCreators(): Promise<Creator[] | null> {
  try {
    const { data, error } = await supabase
      .from("creators")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[creators] listCreators error:", error)
      return null
    }

    return data || []
  } catch (err) {
    console.error("[creators] listCreators exception:", err)
    return null
  }
}

/**
 * 获取单个 creator
 * @param creatorId Creator ID
 * @returns Creator 或 null（如果查询失败）
 */
export async function getCreator(creatorId: string): Promise<Creator | null> {
  try {
    const { data, error } = await supabase
      .from("creators")
      .select("*")
      .eq("id", creatorId)
      .single()

    if (error) {
      console.error("[creators] getCreator error:", error)
      return null
    }

    return data
  } catch (err) {
    console.error("[creators] getCreator exception:", err)
    return null
  }
}



