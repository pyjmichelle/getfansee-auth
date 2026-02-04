/**
 * Creator 统计数据服务
 * 从数据库获取真实的订阅、销售和收益数据
 *
 * P0 安全修复：改用用户 session client，确保只能查询自己的数据
 * 依赖 RLS 策略（migration 025）进行访问控制
 */

import { getSupabaseUniversalClient } from "./supabase-universal";
import { getCurrentUserUniversal } from "./auth-universal";

export interface CreatorStats {
  revenue: {
    value: number; // 美元
    change: number; // 百分比
    trend: "up" | "down";
  };
  subscribers: {
    value: number;
    change: number;
    trend: "up" | "down";
  };
  ppvSales: {
    value: number;
    change: number;
    trend: "up" | "down";
  };
  visitors: {
    value: number;
    change: number;
    trend: "up" | "down";
  };
}

export interface ChartDataPoint {
  date: string;
  revenue: number;
  subscribers: number;
}

/**
 * 获取 Creator 统计数据
 * P0 安全修复：验证调用者身份，确保只能查询自己的数据
 */
export async function getCreatorStats(
  creatorId: string,
  timeRange: "7d" | "30d" | "90d" = "30d"
): Promise<CreatorStats> {
  // P0 安全修复：验证调用者身份
  const currentUser = await getCurrentUserUniversal();
  if (!currentUser || currentUser.id !== creatorId) {
    console.error("[creator-stats] Unauthorized access attempt to stats for:", creatorId);
    // 返回空数据而不是抛出错误，保持向后兼容
    return {
      revenue: { value: 0, change: 0, trend: "up" },
      subscribers: { value: 0, change: 0, trend: "up" },
      ppvSales: { value: 0, change: 0, trend: "up" },
      visitors: { value: 0, change: 0, trend: "up" },
    };
  }

  const supabase = await getSupabaseUniversalClient();

  // 计算时间范围
  const now = new Date();
  const daysMap = { "7d": 7, "30d": 30, "90d": 90 };
  const days = daysMap[timeRange];
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);

  // 1. 计算收益 (从 transactions 表)
  const { data: currentRevenue } = await supabase
    .from("transactions")
    .select("amount_cents")
    .eq("type", "creator_earning")
    .eq("user_id", creatorId)
    .gte("created_at", startDate.toISOString());

  const { data: previousRevenue } = await supabase
    .from("transactions")
    .select("amount_cents")
    .eq("type", "creator_earning")
    .eq("user_id", creatorId)
    .gte("created_at", previousStartDate.toISOString())
    .lt("created_at", startDate.toISOString());

  type RevenueRow = { amount_cents?: number };
  const currentRevenueTotal =
    currentRevenue?.reduce((sum: number, t: RevenueRow) => sum + (t.amount_cents || 0), 0) || 0;
  const previousRevenueTotal =
    previousRevenue?.reduce((sum: number, t: RevenueRow) => sum + (t.amount_cents || 0), 0) || 0;

  const revenueChange =
    previousRevenueTotal > 0
      ? ((currentRevenueTotal - previousRevenueTotal) / previousRevenueTotal) * 100
      : currentRevenueTotal > 0
        ? 100
        : 0;

  // 2. 计算订阅者数量 (从 subscriptions 表)
  const { data: currentSubs } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("creator_id", creatorId)
    .eq("status", "active")
    .gte("created_at", startDate.toISOString());

  const { data: previousSubs } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("creator_id", creatorId)
    .eq("status", "active")
    .gte("created_at", previousStartDate.toISOString())
    .lt("created_at", startDate.toISOString());

  const currentSubsCount = currentSubs?.length || 0;
  const previousSubsCount = previousSubs?.length || 0;

  const subsChange =
    previousSubsCount > 0
      ? ((currentSubsCount - previousSubsCount) / previousSubsCount) * 100
      : currentSubsCount > 0
        ? 100
        : 0;

  // 3. 计算 PPV 销售数量 (从 purchases 表)
  const { data: currentPurchases } = await supabase
    .from("purchases")
    .select("id, posts!inner(creator_id)")
    .eq("posts.creator_id", creatorId)
    .gte("created_at", startDate.toISOString());

  const { data: previousPurchases } = await supabase
    .from("purchases")
    .select("id, posts!inner(creator_id)")
    .eq("posts.creator_id", creatorId)
    .gte("created_at", previousStartDate.toISOString())
    .lt("created_at", startDate.toISOString());

  const currentPurchasesCount = currentPurchases?.length || 0;
  const previousPurchasesCount = previousPurchases?.length || 0;

  const ppvChange =
    previousPurchasesCount > 0
      ? ((currentPurchasesCount - previousPurchasesCount) / previousPurchasesCount) * 100
      : currentPurchasesCount > 0
        ? 100
        : 0;

  // 4. 访客数量 (暂时使用帖子浏览量的总和作为近似值)
  // TODO: 实现真实的访客追踪
  const visitorsValue = 0;
  const visitorsChange = 0;

  return {
    revenue: {
      value: currentRevenueTotal / 100, // 转换为美元
      change: Math.round(revenueChange * 10) / 10,
      trend: revenueChange >= 0 ? "up" : "down",
    },
    subscribers: {
      value: currentSubsCount,
      change: Math.round(subsChange * 10) / 10,
      trend: subsChange >= 0 ? "up" : "down",
    },
    ppvSales: {
      value: currentPurchasesCount,
      change: Math.round(ppvChange * 10) / 10,
      trend: ppvChange >= 0 ? "up" : "down",
    },
    visitors: {
      value: visitorsValue,
      change: visitorsChange,
      trend: "up",
    },
  };
}

/**
 * 获取图表数据
 * P0 安全修复：验证调用者身份
 */
export async function getCreatorChartData(
  creatorId: string,
  timeRange: "7d" | "30d" | "90d" = "30d"
): Promise<ChartDataPoint[]> {
  // P0 安全修复：验证调用者身份
  const currentUser = await getCurrentUserUniversal();
  if (!currentUser || currentUser.id !== creatorId) {
    console.error("[creator-stats] Unauthorized access attempt to chart data for:", creatorId);
    return [];
  }

  const supabase = await getSupabaseUniversalClient();

  const daysMap = { "7d": 7, "30d": 30, "90d": 90 };
  const days = daysMap[timeRange];
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // 获取每日收益数据
  const { data: transactions } = await supabase
    .from("transactions")
    .select("amount_cents, created_at")
    .eq("type", "creator_earning")
    .eq("user_id", creatorId)
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: true });

  // 获取每日新增订阅数据
  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("created_at")
    .eq("creator_id", creatorId)
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: true });

  // 按日期分组
  const dataByDate = new Map<string, { revenue: number; subscribers: number }>();

  // 初始化所有日期
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateKey = date.toISOString().split("T")[0];
    dataByDate.set(dateKey, { revenue: 0, subscribers: 0 });
  }

  // 累计收益
  type TransactionRow = { amount_cents?: number; created_at: string };
  transactions?.forEach((t: TransactionRow) => {
    const dateKey = t.created_at.split("T")[0];
    const existing = dataByDate.get(dateKey) || { revenue: 0, subscribers: 0 };
    existing.revenue += (t.amount_cents || 0) / 100;
    dataByDate.set(dateKey, existing);
  });

  // 累计订阅者
  subscriptions?.forEach((s: { created_at: string }) => {
    const dateKey = s.created_at.split("T")[0];
    const existing = dataByDate.get(dateKey) || { revenue: 0, subscribers: 0 };
    existing.subscribers += 1;
    dataByDate.set(dateKey, existing);
  });

  // 转换为数组并格式化日期
  const chartData: ChartDataPoint[] = [];
  let cumulativeSubscribers = 0;

  dataByDate.forEach((value, dateKey) => {
    cumulativeSubscribers += value.subscribers;
    chartData.push({
      date: new Date(dateKey).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      revenue: Math.round(value.revenue * 100) / 100,
      subscribers: cumulativeSubscribers,
    });
  });

  return chartData;
}

/**
 * 获取最近的帖子列表 (用于 Studio 首页)
 * P0 安全修复：验证调用者身份
 */
export async function getRecentPosts(creatorId: string, limit: number = 3) {
  // P0 安全修复：验证调用者身份
  const currentUser = await getCurrentUserUniversal();
  if (!currentUser || currentUser.id !== creatorId) {
    console.error("[creator-stats] Unauthorized access attempt to posts for:", creatorId);
    return [];
  }

  const supabase = await getSupabaseUniversalClient();

  const { data: posts, error } = await supabase
    .from("posts")
    .select(
      `
      id,
      title,
      content,
      visibility,
      price_cents,
      created_at,
      post_media (
        media_url,
        media_type
      )
    `
    )
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[creator-stats] getRecentPosts error:", error);
    return [];
  }

  // 计算每个帖子的统计数据
  type PostRow = {
    id: string;
    title: string | null;
    content: string;
    visibility: string;
    price_cents: number;
    created_at: string;
    post_media?: { media_url: string; media_type: string }[];
  };
  const postsWithStats = await Promise.all(
    posts.map(async (post: PostRow) => {
      // 获取点赞数 (TODO: 等 post_likes 表创建后实现)
      const likes = 0;

      // 获取浏览数 (TODO: 实现浏览追踪)
      const views = 0;

      // 获取收益 (仅 PPV)
      let revenue = 0;
      if (post.visibility === "ppv" && post.price_cents > 0) {
        const { data: purchases } = await supabase
          .from("purchases")
          .select("paid_amount_cents")
          .eq("post_id", post.id);

        revenue =
          (purchases?.reduce(
            (sum: number, p: { paid_amount_cents?: number }) => sum + (p.paid_amount_cents ?? 0),
            0
          ) || 0) / 100;
      }

      return {
        id: post.id,
        type: post.visibility as "free" | "subscribers" | "ppv",
        price: post.visibility === "ppv" ? post.price_cents / 100 : undefined,
        content: post.title || post.content.substring(0, 50) + "...",
        mediaUrl:
          post.post_media && post.post_media.length > 0
            ? post.post_media[0].media_url
            : "/placeholder.svg?height=300&width=400",
        createdAt: post.created_at,
        likes,
        views,
        revenue,
      };
    })
  );

  return postsWithStats;
}
