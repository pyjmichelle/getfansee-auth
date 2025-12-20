/**
 * Paywall 数据访问层
 * Money & Access MVP: 订阅和 PPV 解锁
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
    const currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // +30 days

    // 使用 upsert（ON CONFLICT fan_id, creator_id DO UPDATE）
    const { error } = await supabase
      .from("subscriptions")
      .upsert(
        {
          fan_id: user.id,
          creator_id: creatorId,
          plan: "monthly",
          status: "active",
          current_period_end: currentPeriodEnd.toISOString(),
        },
        {
          onConflict: "fan_id,creator_id",
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
      .eq("fan_id", user.id)
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
  return isActiveSubscriber(await getCurrentUser()?.id || null, creatorId)
}

/**
 * 检查用户是否是活跃订阅者（可复用，不依赖当前用户）
 * @param fanId Fan user ID
 * @param creatorId Creator ID
 * @returns true 是活跃订阅者，false 不是
 */
export async function isActiveSubscriber(fanId: string | null, creatorId: string): Promise<boolean> {
  if (!fanId) {
    return false
  }

  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("fan_id", fanId)
      .eq("creator_id", creatorId)
      .eq("status", "active")
      .gt("current_period_end", new Date().toISOString())
      .maybeSingle()

    if (error) {
      console.error("[paywall] isActiveSubscriber error:", error)
      return false
    }

    return !!data
  } catch (err) {
    console.error("[paywall] isActiveSubscriber exception:", err)
    return false
  }
}

/**
 * 解锁单个 post（PPV unlock - 创建 purchase）
 * @param postId Post ID
 * @param priceCents Price in cents (from post.price_cents)
 * @returns true 成功，false 失败（unique 冲突视为成功）
 */
export async function unlockPost(postId: string, priceCents: number): Promise<boolean> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      console.error("[paywall] unlockPost: no user")
      return false
    }

    // Get post price if not provided
    if (!priceCents) {
      const { data: post, error: postError } = await supabase
        .from("posts")
        .select("price_cents")
        .eq("id", postId)
        .single()

      if (postError || !post) {
        console.error("[paywall] unlockPost: post not found", postError)
        return false
      }

      priceCents = post.price_cents || 0
    }

    // Create purchase record
    const { error } = await supabase.from("purchases").insert({
      fan_id: user.id,
      post_id: postId,
      paid_amount_cents: priceCents,
    })

    if (error) {
      // unique 冲突视为成功（已购买）
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
 * 检查用户是否已购买 post（可复用，不依赖当前用户）
 * @param fanId Fan user ID
 * @param postId Post ID
 * @returns true 已购买，false 未购买
 */
export async function hasPurchasedPost(fanId: string | null, postId: string): Promise<boolean> {
  if (!fanId) {
    return false
  }

  try {
    const { data, error } = await supabase
      .from("purchases")
      .select("id")
      .eq("fan_id", fanId)
      .eq("post_id", postId)
      .maybeSingle()

    if (error) {
      console.error("[paywall] hasPurchasedPost error:", error)
      return false
    }

    return !!data
  } catch (err) {
    console.error("[paywall] hasPurchasedPost exception:", err)
    return false
  }
}

/**
 * 检查是否可以查看 post（creator 本人 OR active subscription OR purchase）
 * 使用新的 schema: price_cents=0 表示 subscriber-only, price_cents>0 表示 PPV
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

    // 2. 查询 post 信息（包括 price_cents 和 creator_id）
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id, price_cents, creator_id")
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

    // 4. 根据 price_cents 判断
    const priceCents = post.price_cents || 0

    // price_cents = 0: subscriber-only，需要订阅
    if (priceCents === 0) {
      return await isActiveSubscriber(user.id, post.creator_id)
    }

    // price_cents > 0: PPV，需要购买
    if (priceCents > 0) {
      return await hasPurchasedPost(user.id, postId)
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
      .eq("fan_id", userId)
      .eq("status", "active")
      .gt("current_period_end", new Date().toISOString())

    if (subError) {
      console.error("[paywall] getMyPaywallState subscriptions error:", subError)
      return null
    }

    // 2. 查询 purchased posts
    const { data: purchases, error: purchaseError } = await supabase
      .from("purchases")
      .select("post_id")
      .eq("fan_id", userId)

    if (purchaseError) {
      console.error("[paywall] getMyPaywallState purchases error:", purchaseError)
      return null
    }

    const unlockedPostIds = new Set<string>(
      purchases?.map((p) => p.post_id) || []
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
