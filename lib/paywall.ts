/**
 * Paywall 数据访问层
 * Phase 2: 付费墙最小闭环
 */

import { supabase } from "./supabase-client"
import { getCurrentUser } from "./auth"

export type PaywallState = {
  hasActiveSubscription: boolean
  unlockedPostIds: Set<string>
}

/**
 * 订阅 30 天（创建/更新 subscription）
 * @param creatorId Creator ID
 * @returns true 成功，false 失败
 */
export async function subscribe30d(creatorId: string): Promise<boolean> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      console.error("[paywall] subscribe30d: no user")
      return false
    }

    const now = new Date()
    const endsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // +30 days

    // 使用 upsert（ON CONFLICT subscriber_id, creator_id DO UPDATE）
    const { error } = await supabase
      .from("subscriptions")
      .upsert(
        {
          subscriber_id: user.id,
          creator_id: creatorId,
          status: "active",
          starts_at: now.toISOString(),
          ends_at: endsAt.toISOString(),
        },
        {
          onConflict: "subscriber_id,creator_id",
        }
      )

    if (error) {
      console.error("[paywall] subscribe30d error:", error)
      return false
    }

    return true
  } catch (err) {
    console.error("[paywall] subscribe30d exception:", err)
    return false
  }
}

/**
 * 取消订阅
 * @param creatorId Creator ID
 * @returns true 成功，false 失败
 */
export async function cancelSubscription(creatorId: string): Promise<boolean> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      console.error("[paywall] cancelSubscription: no user")
      return false
    }

    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("subscriber_id", user.id)
      .eq("creator_id", creatorId)

    if (error) {
      console.error("[paywall] cancelSubscription error:", error)
      return false
    }

    return true
  } catch (err) {
    console.error("[paywall] cancelSubscription exception:", err)
    return false
  }
}

/**
 * 检查是否有 active subscription
 * @param creatorId Creator ID
 * @returns true 有 active subscription，false 没有
 */
export async function hasActiveSubscription(creatorId: string): Promise<boolean> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return false
    }

    const { data, error } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("subscriber_id", user.id)
      .eq("creator_id", creatorId)
      .eq("status", "active")
      .gt("ends_at", new Date().toISOString())
      .maybeSingle()

    if (error) {
      console.error("[paywall] hasActiveSubscription error:", error)
      return false
    }

    return !!data
  } catch (err) {
    console.error("[paywall] hasActiveSubscription exception:", err)
    return false
  }
}

/**
 * 解锁单个 post（PPV unlock）
 * @param postId Post ID
 * @returns true 成功，false 失败（unique 冲突视为成功）
 */
export async function unlockPost(postId: string): Promise<boolean> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      console.error("[paywall] unlockPost: no user")
      return false
    }

    const { error } = await supabase.from("post_unlocks").insert({
      user_id: user.id,
      post_id: postId,
    })

    if (error) {
      // unique 冲突视为成功（已解锁）
      if (error.code === "23505") {
        return true
      }
      console.error("[paywall] unlockPost error:", error)
      return false
    }

    return true
  } catch (err) {
    console.error("[paywall] unlockPost exception:", err)
    return false
  }
}

/**
 * 检查是否可以查看 post（creator 本人 OR active subscription OR post_unlock）
 * @param postId Post ID
 * @param creatorId Creator ID（可选，如果提供可以更快判断）
 * @returns true 可以查看，false 不能查看
 */
export async function canViewPost(postId: string, creatorId?: string): Promise<boolean> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return false
    }

    // 1. 检查是否是 creator 本人
    if (creatorId && creatorId === user.id) {
      return true
    }

    // 2. 查询 post 信息（包括 visibility 和 creator_id）
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id, visibility, creator_id")
      .eq("id", postId)
      .single()

    if (postError || !post) {
      console.error("[paywall] canViewPost: post not found", postError)
      return false
    }

    // 3. 如果是 creator 本人（永远可见）
    if (post.creator_id === user.id) {
      return true
    }

    // 4. 根据 visibility 判断
    const visibility = post.visibility || 'free'

    // free: 所有人可见
    if (visibility === 'free') {
      return true
    }

    // subscribers: 需要订阅
    if (visibility === 'subscribers') {
      const hasSub = await hasActiveSubscription(post.creator_id)
      return hasSub
    }

    // ppv: 需要单独解锁（订阅不覆盖）
    if (visibility === 'ppv') {
      const { data: unlock, error: unlockError } = await supabase
        .from("post_unlocks")
        .select("id")
        .eq("user_id", user.id)
        .eq("post_id", postId)
        .maybeSingle()

      if (unlockError) {
        console.error("[paywall] canViewPost: unlock check error", unlockError)
        return false
      }

      return !!unlock
    }

    return false
  } catch (err) {
    console.error("[paywall] canViewPost exception:", err)
    return false
  }
}

/**
 * 获取当前用户的 paywall 状态（用于批量检查）
 * @param userId 用户 ID
 * @returns PaywallState 或 null（如果查询失败）
 */
export async function getMyPaywallState(userId: string): Promise<PaywallState | null> {
  try {
    // 1. 查询 active subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("subscriptions")
      .select("creator_id")
      .eq("subscriber_id", userId)
      .eq("status", "active")
      .gt("ends_at", new Date().toISOString())

    if (subError) {
      console.error("[paywall] getMyPaywallState subscriptions error:", subError)
      return null
    }

    // 2. 查询 unlocked posts
    const { data: unlocks, error: unlockError } = await supabase
      .from("post_unlocks")
      .select("post_id")
      .eq("user_id", userId)

    if (unlockError) {
      console.error("[paywall] getMyPaywallState post_unlocks error:", unlockError)
      return null
    }

    const unlockedPostIds = new Set<string>(
      unlocks?.map((u) => u.post_id) || []
    )

    return {
      hasActiveSubscription: (subscriptions?.length || 0) > 0,
      unlockedPostIds,
    }
  } catch (err) {
    console.error("[paywall] getMyPaywallState exception:", err)
    return null
  }
}
