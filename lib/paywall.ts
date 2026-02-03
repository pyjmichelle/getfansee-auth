/**
 * Paywall 数据访问层
 * Money & Access MVP: 订阅和 PPV 解锁
 */

import { getSupabaseUniversalClient } from "./supabase-universal";
import { getCurrentUserUniversal } from "./auth-universal";
import { getSubscriptionUserId, resolveSubscriptionUserColumn } from "./subscriptions";

export type PaywallState = {
  hasActiveSubscription: boolean;
  unlockedPostIds: Set<string>;
};

/**
 * 订阅 30 天（创建/更新 subscription）
 * @param creatorId Creator ID
 * @returns true 成功，false 失败
 */
export async function subscribe30d(creatorId: string): Promise<boolean> {
  try {
    const user = await getCurrentUserUniversal();
    if (!user) {
      console.error("[paywall] subscribe30d: no user");
      return false;
    }

    const supabase = await getSupabaseUniversalClient();
    const now = new Date();
    const currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days

    const subscriptionUserColumn = await resolveSubscriptionUserColumn(supabase);
    // 使用 upsert（ON CONFLICT user_column, creator_id DO UPDATE）
    const { error } = await supabase.from("subscriptions").upsert(
      {
        [subscriptionUserColumn]: user.id,
        creator_id: creatorId,
        plan: "monthly",
        status: "active",
        current_period_end: currentPeriodEnd.toISOString(),
      },
      {
        onConflict: `${subscriptionUserColumn},creator_id`,
      }
    );

    if (error) {
      console.error("[paywall] subscribe30d error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[paywall] subscribe30d exception:", err);
    return false;
  }
}

/**
 * 取消订阅
 * @param creatorId Creator ID
 * @returns true 成功，false 失败
 */
export async function cancelSubscription(creatorId: string): Promise<boolean> {
  try {
    const user = await getCurrentUserUniversal();
    if (!user) {
      console.error("[paywall] cancelSubscription: no user");
      return false;
    }

    const supabase = await getSupabaseUniversalClient();
    const subscriptionUserColumn = await resolveSubscriptionUserColumn(supabase);
    // 更新状态为 canceled，并设置 cancelled_at 时间戳
    const { error } = await supabase
      .from("subscriptions")
      .update({
        status: "canceled",
        cancelled_at: new Date().toISOString(),
      })
      .eq(subscriptionUserColumn, user.id)
      .eq("creator_id", creatorId);

    if (error) {
      console.error("[paywall] cancelSubscription error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[paywall] cancelSubscription exception:", err);
    return false;
  }
}

/**
 * 获取订阅者列表（Creator 使用）
 * @param creatorId Creator ID
 * @returns 订阅者列表
 */
export async function listSubscribers(creatorId: string): Promise<
  Array<{
    id: string;
    fan_id: string;
    fan_display_name: string | null;
    fan_avatar_url: string | null;
    status: string;
    starts_at: string;
    ends_at: string;
    cancelled_at: string | null;
    created_at: string;
  }>
> {
  try {
    const supabase = await getSupabaseUniversalClient();
    const subscriptionUserColumn = await resolveSubscriptionUserColumn(supabase);
    const { data, error } = await supabase
      .from("subscriptions")
      .select(
        `
        id,
        status,
        starts_at,
        current_period_end,
        cancelled_at,
        created_at
      `
      )
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[paywall] listSubscribers error:", error);
      return [];
    }

    type SubscriptionRow = {
      id: string;
      status: string;
      starts_at: string;
      current_period_end?: string | null;
      cancelled_at: string | null;
      created_at: string;
    } & Partial<Record<"subscriber_id" | "fan_id" | "user_id", string | null>>;

    const rows = ((data as SubscriptionRow[] | null) || []).map((sub) => ({
      ...sub,
      subscriberId: getSubscriptionUserId(sub, subscriptionUserColumn),
    }));

    const subscriberIds = rows
      .map((row) => row.subscriberId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const { data: profiles } =
      subscriberIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .in("id", subscriberIds)
        : { data: [] };

    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));

    return rows.map((sub) => {
      const profile = sub.subscriberId ? profileMap.get(sub.subscriberId) : null;
      return {
        id: sub.id,
        fan_id: sub.subscriberId || "",
        fan_display_name: profile?.display_name || null,
        fan_avatar_url: profile?.avatar_url || null,
        status: sub.status,
        starts_at: sub.starts_at,
        ends_at: sub.current_period_end || sub.starts_at,
        cancelled_at: sub.cancelled_at,
        created_at: sub.created_at,
      };
    });
  } catch (err) {
    console.error("[paywall] listSubscribers exception:", err);
    return [];
  }
}

/**
 * 获取创作者收益明细（从 transactions 表）
 * @param creatorId Creator ID
 * @returns 交易列表
 */
export async function getCreatorEarnings(creatorId: string): Promise<
  Array<{
    id: string;
    type: string;
    amount_cents: number;
    status: string;
    available_on: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>
> {
  try {
    const supabase = await getSupabaseUniversalClient();
    // 查询所有与创作者相关的交易（订阅、PPV购买等）
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .or(`metadata->>'creator_id'.eq.${creatorId},type.eq.subscription,type.eq.ppv_purchase`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[paywall] getCreatorEarnings error:", error);
      return [];
    }

    // 过滤出真正属于该创作者的交易
    type TransactionRow = {
      id: string;
      type: string;
      amount_cents: number;
      status: string;
      available_on: string | null;
      created_at: string;
      metadata: Record<string, unknown> | null;
    };

    return ((data as TransactionRow[] | null) || [])
      .filter((t) => {
        // 如果是订阅或PPV，检查 metadata 中的 creator_id
        if (t.metadata && t.metadata.creator_id === creatorId) {
          return true;
        }
        return false;
      })
      .map((t) => ({
        id: t.id,
        type: t.type,
        amount_cents: t.amount_cents,
        status: t.status,
        available_on: t.available_on,
        metadata: t.metadata,
        created_at: t.created_at,
      }));
  } catch (err) {
    console.error("[paywall] getCreatorEarnings exception:", err);
    return [];
  }
}

/**
 * 检查是否有 active subscription
 * @param creatorId Creator ID
 * @returns true 有 active subscription，false 没有
 */
export async function hasActiveSubscription(creatorId: string): Promise<boolean> {
  const user = await getCurrentUserUniversal();
  return isActiveSubscriber(user?.id || null, creatorId);
}

/**
 * 检查用户是否是活跃订阅者（可复用，不依赖当前用户）
 * @param fanId Fan user ID
 * @param creatorId Creator ID
 * @returns true 是活跃订阅者，false 不是
 */
export async function isActiveSubscriber(
  fanId: string | null,
  creatorId: string
): Promise<boolean> {
  if (!fanId) {
    return false;
  }

  try {
    const supabase = await getSupabaseUniversalClient();
    const subscriptionUserColumn = await resolveSubscriptionUserColumn(supabase);
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id")
      .eq(subscriptionUserColumn, fanId)
      .eq("creator_id", creatorId)
      .eq("status", "active")
      .gt("current_period_end", new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.error("[paywall] isActiveSubscriber error:", error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error("[paywall] isActiveSubscriber exception:", err);
    return false;
  }
}

/**
 * 解锁单个 post（PPV unlock - 使用原子扣费函数）
 * @param postId Post ID
 * @param priceCents Price in cents (from post.price_cents, optional)
 * @returns { success: boolean, error?: string, balance_after_cents?: number }
 */
export async function unlockPost(
  postId: string,
  priceCents?: number,
  idempotencyKey?: string
): Promise<{ success: boolean; error?: string; balance_after_cents?: number }> {
  try {
    const user = await getCurrentUserUniversal();
    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    const supabase = await getSupabaseUniversalClient();
    // Get post price if not provided
    if (!priceCents) {
      const { data: post, error: postError } = await supabase
        .from("posts")
        .select("price_cents")
        .eq("id", postId)
        .single();

      if (postError || !post) {
        console.error("[paywall] unlockPost: post not found", postError);
        return { success: false, error: "Post not found" };
      }

      priceCents = post.price_cents || 0;
    }

    // 调用原子扣费函数（在数据库内部完成：检查余额 -> 扣费 -> 记录交易 -> 创建购买）
    const { data, error } = await supabase.rpc("unlock_ppv", {
      p_post_id: postId,
      p_user_id: user.id,
      p_idempotency_key: idempotencyKey ?? null,
    });

    if (error) {
      console.error("[paywall] unlockPost rpc error:", error);
      return { success: false, error: error.message };
    }

    if (!data || !data.success) {
      return {
        success: false,
        error: data?.error || "Purchase failed",
        balance_after_cents: data?.balance_after_cents,
      };
    }

    return {
      success: true,
      balance_after_cents: data.balance_after_cents ?? data.balance ?? 0,
    };
  } catch (err: unknown) {
    console.error("[paywall] unlockPost exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * 获取钱包余额
 * @returns { success: boolean, balance_cents?: number, error?: string }
 */
export async function getWalletBalance(): Promise<{
  success: boolean;
  balance_cents?: number;
  error?: string;
}> {
  try {
    const user = await getCurrentUserUniversal();
    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    const supabase = await getSupabaseUniversalClient();
    const { data, error } = await supabase.rpc("rpc_get_wallet_balance", {
      p_user_id: user.id,
    });

    if (error) {
      console.error("[paywall] getWalletBalance error:", error);
      return { success: false, error: error.message };
    }

    if (!data || !data.success) {
      return { success: false, error: data?.error || "Failed to get balance" };
    }

    return {
      success: true,
      balance_cents: data.balance_cents || 0,
    };
  } catch (err: unknown) {
    console.error("[paywall] getWalletBalance exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
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
    return false;
  }

  try {
    const supabase = await getSupabaseUniversalClient();
    const { data, error } = await supabase
      .from("purchases")
      .select("id")
      .eq("fan_id", fanId)
      .eq("post_id", postId)
      .maybeSingle();

    if (error) {
      console.error("[paywall] hasPurchasedPost error:", error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error("[paywall] hasPurchasedPost exception:", err);
    return false;
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
    const user = await getCurrentUserUniversal();
    if (!user) {
      return false;
    }

    // 1. 检查是否是 creator 本人
    if (creatorId && creatorId === user.id) {
      return true;
    }

    // 2. 查询 post 信息（包括 price_cents 和 creator_id）
    const supabase = await getSupabaseUniversalClient();
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id, price_cents, creator_id")
      .eq("id", postId)
      .single();

    if (postError || !post) {
      console.error("[paywall] canViewPost: post not found", postError);
      return false;
    }

    // 3. 如果是 creator 本人（永远可见）
    if (post.creator_id === user.id) {
      return true;
    }

    // 4. 根据 price_cents 判断
    const priceCents = post.price_cents || 0;

    // price_cents = 0: subscriber-only，需要订阅
    if (priceCents === 0) {
      return await isActiveSubscriber(user.id, post.creator_id);
    }

    // price_cents > 0: PPV，需要购买
    if (priceCents > 0) {
      return await hasPurchasedPost(user.id, postId);
    }

    return false;
  } catch (err) {
    console.error("[paywall] canViewPost exception:", err);
    return false;
  }
}

/**
 * 获取当前用户的 paywall 状态（用于批量检查）
 * @param userId 用户 ID
 * @returns PaywallState 或 null（如果查询失败）
 */
export async function getMyPaywallState(userId: string): Promise<PaywallState | null> {
  try {
    const supabase = await getSupabaseUniversalClient();
    const subscriptionUserColumn = await resolveSubscriptionUserColumn(supabase);
    // 1. 查询 active subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("subscriptions")
      .select("creator_id")
      .eq(subscriptionUserColumn, userId)
      .eq("status", "active")
      .gt("current_period_end", new Date().toISOString());

    if (subError) {
      console.error("[paywall] getMyPaywallState subscriptions error:", subError);
      return null;
    }

    // 2. 查询 purchased posts
    const { data: purchases, error: purchaseError } = await supabase
      .from("purchases")
      .select("post_id")
      .eq("fan_id", userId);

    if (purchaseError) {
      console.error("[paywall] getMyPaywallState purchases error:", purchaseError);
      return null;
    }

    const unlockedPostIds = new Set<string>(purchases?.map((p) => p.post_id) || []);

    return {
      hasActiveSubscription: (subscriptions?.length || 0) > 0,
      unlockedPostIds,
    };
  } catch (err) {
    console.error("[paywall] getMyPaywallState exception:", err);
    return null;
  }
}

/**
 * 批量检查用户对多个 creator 的订阅状态（避免 N+1 查询）
 * @param fanId 用户 ID
 * @param creatorIds Creator ID 数组
 * @returns Map<creatorId, boolean> - 是否订阅
 */
export async function batchCheckSubscriptions(
  fanId: string | null,
  creatorIds: string[]
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();

  if (!fanId || creatorIds.length === 0) {
    creatorIds.forEach((id) => result.set(id, false));
    return result;
  }

  try {
    const supabase = await getSupabaseUniversalClient();
    const subscriptionUserColumn = await resolveSubscriptionUserColumn(supabase);
    const now = new Date().toISOString();

    // 批量查询所有订阅状态
    const { data: subscriptions, error } = await supabase
      .from("subscriptions")
      .select("creator_id")
      .eq(subscriptionUserColumn, fanId)
      .eq("status", "active")
      .gt("current_period_end", now)
      .in("creator_id", creatorIds);

    if (error) {
      console.error("[paywall] batchCheckSubscriptions error:", error);
      creatorIds.forEach((id) => result.set(id, false));
      return result;
    }

    // 初始化所有 creator 为 false
    creatorIds.forEach((id) => result.set(id, false));

    // 设置有订阅的 creator 为 true
    subscriptions?.forEach((sub) => {
      result.set(sub.creator_id, true);
    });

    return result;
  } catch (err) {
    console.error("[paywall] batchCheckSubscriptions exception:", err);
    creatorIds.forEach((id) => result.set(id, false));
    return result;
  }
}

/**
 * 批量检查用户对多个 post 的购买状态（避免 N+1 查询）
 * @param fanId 用户 ID
 * @param postIds Post ID 数组
 * @returns Map<postId, boolean> - 是否购买
 */
export async function batchCheckPurchases(
  fanId: string | null,
  postIds: string[]
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();

  if (!fanId || postIds.length === 0) {
    postIds.forEach((id) => result.set(id, false));
    return result;
  }

  try {
    const supabase = await getSupabaseUniversalClient();

    // 批量查询所有购买状态
    const { data: purchases, error } = await supabase
      .from("purchases")
      .select("post_id")
      .eq("fan_id", fanId)
      .in("post_id", postIds);

    if (error) {
      console.error("[paywall] batchCheckPurchases error:", error);
      postIds.forEach((id) => result.set(id, false));
      return result;
    }

    // 初始化所有 post 为 false
    postIds.forEach((id) => result.set(id, false));

    // 设置已购买的 post 为 true
    purchases?.forEach((purchase) => {
      result.set(purchase.post_id, true);
    });

    return result;
  } catch (err) {
    console.error("[paywall] batchCheckPurchases exception:", err);
    postIds.forEach((id) => result.set(id, false));
    return result;
  }
}
