"use client";

import { useState, useEffect } from "react";
import { DollarSign, Users, Eye, Heart, Plus, Coins } from "@/lib/icons";
import { PageShell } from "@/components/page-shell";
// Card, Badge, Skeleton, StatCard, CenteredContainer no longer needed - using Figma inline styles
// EmptyState no longer needed - using Figma inline styles
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { DEFAULT_POST_MEDIA } from "@/lib/image-fallbacks";
import { getAuthBootstrap } from "@/lib/auth-bootstrap-client";
import { useSkeletonMetric } from "@/hooks/use-skeleton-metric";
import { formatDistanceToNow } from "date-fns";
import { ErrorState } from "@/components/error-state";

// 延迟加载图表组件以提高首屏加载速度
const _StudioChart = dynamic(
  () => import("@/components/studio-chart").then((mod) => mod.StudioChart),
  {
    loading: () => (
      <div className="w-full h-[300px] flex items-center justify-center bg-white/8 rounded-lg animate-pulse" />
    ),
    ssr: false,
  }
);

export default function CreatorStudioPage() {
  const router = useRouter();
  const [_timeRange, _setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useSkeletonMetric("creator_studio_page", isLoading);

  const [stats, setStats] = useState({
    revenue: { value: 0, change: 0, trend: "up" as "up" | "down" },
    subscribers: { value: 0, change: 0, trend: "up" as "up" | "down" },
    ppvSales: { value: 0, change: 0, trend: "up" as "up" | "down" },
    visitors: { value: 0, change: 0, trend: "up" as "up" | "down" },
  });

  const [_chartData, _setChartData] = useState<
    Array<{ date: string; revenue: number; subscribers: number }>
  >([]);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        const bootstrap = await getAuthBootstrap();
        if (!bootstrap.authenticated || !bootstrap.user) {
          router.push("/auth");
          return;
        }

        if (bootstrap.profile?.role !== "creator") {
          router.push("/home");
          return;
        }
        setCurrentUserId(bootstrap.user.id);
        setCurrentUser({
          username: bootstrap.profile?.display_name || bootstrap.user.email.split("@")[0] || "user",
          role: "creator",
          avatar: bootstrap.profile?.avatar_url || undefined,
        });

        // 并行加载统计和最近帖子，减少切页等待。
        await Promise.all([loadStats(), loadRecentPosts()]);
      } catch (err) {
        console.error("[studio] loadData error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router]);

  // 加载统计数据
  const loadStats = async () => {
    try {
      setStatsError(null);
      const response = await fetch(
        `/api/creator/stats?timeRange=${_timeRange}&includeChart=true&includePosts=false`
      );
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
        if (data.chartData) {
          _setChartData(data.chartData);
        }
      } else {
        setStatsError("Failed to load studio stats. Please try again.");
      }
    } catch (err) {
      console.error("[studio] loadStats error:", err);
      setStatsError("Failed to load studio stats. Please try again.");
    }
  };

  // 当时间范围变化时重新加载统计数据
  useEffect(() => {
    if (currentUserId) {
      loadStats();
    }
  }, [_timeRange, currentUserId]);

  const [recentPosts, setRecentPosts] = useState<
    Array<{
      id: string;
      type: "free" | "subscribers" | "ppv";
      price?: number;
      content: string;
      mediaUrl: string;
      createdAt: string;
      likes: number;
      views: number;
      revenue: number;
    }>
  >([]);

  const loadRecentPosts = async () => {
    try {
      const response = await fetch("/api/creator/stats?includePosts=true");
      const data = await response.json();

      if (data.success && data.recentPosts) {
        setRecentPosts(data.recentPosts);
      }
    } catch (err) {
      console.error("[studio] loadRecentPosts error:", err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };
  const totalRevenue = Math.max(stats.revenue.value, 0);
  const unlocksRevenueRaw = recentPosts
    .filter((post) => post.type === "ppv")
    .reduce((sum, post) => sum + Math.max(post.revenue, 0), 0);
  const tipsRevenueRaw = recentPosts
    .filter((post) => post.type === "free")
    .reduce((sum, post) => sum + Math.max(post.revenue, 0), 0);
  const unlocksRevenue = Math.min(unlocksRevenueRaw, totalRevenue);
  const tipsRevenue = Math.min(tipsRevenueRaw, Math.max(totalRevenue - unlocksRevenue, 0));
  const subscriptionsRevenue = Math.max(totalRevenue - unlocksRevenue - tipsRevenue, 0);
  const revenueBreakdown = [
    {
      label: "Subscriptions",
      amount: subscriptionsRevenue,
      percent: totalRevenue > 0 ? (subscriptionsRevenue / totalRevenue) * 100 : 0,
      barClass: "bg-brand-primary",
    },
    {
      label: "Unlocks",
      amount: unlocksRevenue,
      percent: totalRevenue > 0 ? (unlocksRevenue / totalRevenue) * 100 : 0,
      barClass: "bg-accent",
    },
    {
      label: "Tips",
      amount: tipsRevenue,
      percent: totalRevenue > 0 ? (tipsRevenue / totalRevenue) * 100 : 0,
      barClass: "bg-gradient-to-r from-amber-500 to-amber-600",
    },
  ];
  const recentActivity = recentPosts.slice(0, 4).map((post) => ({
    icon: post.type === "subscribers" ? Users : post.type === "ppv" ? Coins : Heart,
    text:
      post.type === "ppv"
        ? `PPV post earned $${post.revenue.toFixed(2)}`
        : post.type === "subscribers"
          ? `Subscriber post gained ${post.views.toLocaleString()} views`
          : `Free post received ${post.likes.toLocaleString()} likes`,
    time: formatDistanceToNow(new Date(post.createdAt), { addSuffix: true }),
    color:
      post.type === "ppv" ? "amber-500" : post.type === "subscribers" ? "brand-primary" : "error",
  }));

  if (isLoading) {
    return (
      <PageShell user={currentUser} notificationCount={0} maxWidth="5xl">
        <div className="pb-12 space-y-6 animate-pulse">
          <div className="card-block bg-gradient-subtle p-6 md:p-8">
            <div className="h-8 w-56 bg-white/8 rounded mb-3" />
            <div className="h-4 w-80 bg-white/8 rounded mb-6" />
            <div className="h-10 w-40 bg-white/8 rounded-xl" />
          </div>
          <div className="bento-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card-block h-28 bg-white/8" />
            ))}
          </div>
          <div className="h-64 bg-white/8 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-40 bg-white/8 rounded-2xl" />
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell user={currentUser} notificationCount={0} maxWidth="6xl">
      <div data-testid="page-ready" className="pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-1 text-text-primary">Creator Dashboard</h1>
            <p className="text-text-tertiary text-sm">Track your performance and earnings</p>
          </div>
          <Link
            href="/creator/new-post"
            className="px-5 py-2.5 bg-brand-primary text-white rounded-xl font-bold hover-bold shadow-glow transition-all flex items-center justify-center gap-2 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary w-full sm:w-auto"
          >
            <Plus size={18} />
            Create Post
          </Link>
        </div>
        {statsError && (
          <ErrorState
            className="mb-6"
            title="Studio stats unavailable"
            message={statsError}
            retry={loadStats}
          />
        )}

        {/* PC: Two-column | Mobile: Single-column */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main content column */}
          <div className="flex-1 min-w-0">
            {/* Quick Actions (mobile) */}
            <div className="grid grid-cols-2 gap-3 mb-6 lg:hidden" data-testid="creator-nav">
              <Link
                href="/creator/studio/earnings"
                className="px-4 py-3.5 bg-surface-raised border border-border-base rounded-xl font-semibold hover:bg-surface-overlay transition-all flex items-center justify-center gap-2 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary text-sm"
              >
                <DollarSign size={18} />
                Earnings
              </Link>
              <Link
                href="/creator/studio/subscribers"
                className="px-4 py-3.5 bg-surface-raised border border-border-base rounded-xl font-semibold hover:bg-surface-overlay transition-all flex items-center justify-center gap-2 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary text-sm"
              >
                <Users size={18} />
                Subscribers
              </Link>
            </div>

            {/* Key Stats - Figma Style */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" data-testid="creator-stats">
              <div className="card-block p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                    <DollarSign size={20} className="text-success" />
                  </div>
                </div>
                <div className="text-3xl font-bold mb-1 text-text-primary">
                  ${stats.revenue.value.toFixed(0)}
                </div>
                <div className="text-sm text-text-tertiary">This month</div>
                <div
                  className={`text-xs mt-2 ${stats.revenue.trend === "down" ? "text-error" : "text-success"}`}
                >
                  {stats.revenue.trend === "down" ? "-" : "+"}
                  {Math.abs(stats.revenue.change)}% from last month
                </div>
              </div>

              <div className="card-block p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-brand-primary-alpha-10 rounded-lg flex items-center justify-center">
                    <Users size={20} className="text-brand-primary" />
                  </div>
                </div>
                <div className="text-3xl font-bold mb-1 text-text-primary">
                  {stats.subscribers.value.toLocaleString()}
                </div>
                <div className="text-sm text-text-tertiary">Subscribers</div>
                <div
                  className={`text-xs mt-2 ${stats.subscribers.trend === "down" ? "text-error" : "text-success"}`}
                >
                  {stats.subscribers.trend === "down" ? "-" : "+"}
                  {Math.abs(stats.subscribers.change)} this month
                </div>
              </div>

              <div className="card-block p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                    <Eye size={20} className="text-accent" />
                  </div>
                </div>
                <div className="text-3xl font-bold mb-1 text-text-primary">
                  {stats.visitors.value.toLocaleString()}
                </div>
                <div className="text-sm text-text-tertiary">Total views</div>
                <div
                  className={`text-xs mt-2 ${stats.visitors.trend === "down" ? "text-error" : "text-success"}`}
                >
                  {stats.visitors.trend === "down" ? "-" : "+"}
                  {Math.abs(stats.visitors.change)}% from last month
                </div>
              </div>

              <div className="card-block p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-brand-secondary/10 rounded-lg flex items-center justify-center">
                    <Heart size={20} className="text-brand-secondary" />
                  </div>
                </div>
                <div className="text-3xl font-bold mb-1 text-text-primary">
                  {stats.ppvSales.value}
                </div>
                <div className="text-sm text-text-tertiary">PPV Sales</div>
                <div
                  className={`text-xs mt-2 ${stats.ppvSales.trend === "down" ? "text-error" : "text-success"}`}
                >
                  {stats.ppvSales.trend === "down" ? "-" : "+"}
                  {Math.abs(stats.ppvSales.change)}% from last month
                </div>
              </div>
            </div>

            {/* Top Performing Posts - Figma Style */}
            <div className="mb-8">
              <h3 className="text-xl font-bold mb-4 text-text-primary">Top Performing Posts</h3>
              <div className="grid md:grid-cols-3 gap-4">
                {recentPosts.slice(0, 3).map((post, index) => (
                  <div
                    key={post.id}
                    className="card-block overflow-hidden hover:border-brand-primary/30 transition-all cursor-pointer group"
                    onClick={() => router.push(`/posts/${post.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/posts/${post.id}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="relative aspect-video overflow-hidden bg-black">
                      <img
                        src={post.mediaUrl || DEFAULT_POST_MEDIA}
                        alt={post.content}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute top-2 left-2 w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center font-bold text-white text-sm shadow-lg">
                        #{index + 1}
                      </div>
                    </div>
                    <div className="p-4">
                      <h4 className="font-semibold mb-2 line-clamp-2 text-text-primary">
                        {post.content}
                      </h4>
                      <div className="text-xs text-text-tertiary mb-3">
                        {formatDate(post.createdAt)}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <Eye size={16} className="text-text-tertiary" />
                            <span className="font-medium">{post.views.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Heart size={16} className="text-text-tertiary" />
                            <span className="font-medium">{post.likes}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-success font-bold">
                          <DollarSign size={16} />
                          <span>${post.revenue.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue Breakdown - Figma Style */}
            <div className="card-block p-6 mb-8">
              <h3 className="text-xl font-bold mb-6 text-text-primary">Revenue Breakdown</h3>
              <div className="grid md:grid-cols-3 gap-6">
                {revenueBreakdown.map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-text-secondary">{item.label}</span>
                      <span className="font-bold text-text-primary">
                        {item.percent.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.barClass} rounded-full`}
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                    <div className="text-2xl font-bold mt-3 text-gradient">
                      ${item.amount.toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity - Figma Style */}
            <div className="card-block p-6">
              <h3 className="text-xl font-bold mb-4 text-text-primary">Recent Activity</h3>
              <div className="space-y-4">
                {recentActivity.map((activity, i) => {
                  let bgClass = "bg-brand-primary/10";
                  let textClass = "text-brand-primary";

                  if (activity.color === "amber-500") {
                    bgClass = "bg-amber-500/10";
                    textClass = "text-amber-500";
                  } else if (activity.color === "error") {
                    bgClass = "bg-error/10";
                    textClass = "text-error";
                  } else if (activity.color === "brand-secondary") {
                    bgClass = "bg-brand-secondary/10";
                    textClass = "text-brand-secondary";
                  }

                  return (
                    <div
                      key={i}
                      className="flex items-center gap-4 p-3 hover:bg-white/8 rounded-lg transition-colors"
                    >
                      <div
                        className={`w-10 h-10 ${bgClass} rounded-lg flex items-center justify-center flex-shrink-0`}
                      >
                        <activity.icon size={20} className={textClass} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text-primary">{activity.text}</p>
                        <p className="text-xs text-text-tertiary mt-1">{activity.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar: Navigation links (PC only) */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24 space-y-3">
              <div className="card-block p-4" data-testid="creator-nav">
                <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                  Studio
                </h2>
                <nav className="space-y-1">
                  {[
                    { href: "/creator/new-post", icon: Plus, label: "Create Post" },
                    { href: "/creator/studio/earnings", icon: DollarSign, label: "Earnings" },
                    { href: "/creator/studio/subscribers", icon: Users, label: "Subscribers" },
                    { href: "/creator/studio/post/list", icon: Eye, label: "Post List" },
                    { href: "/creator/studio/analytics", icon: Heart, label: "Analytics" },
                  ].map(({ href, icon: Icon, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
                    >
                      <Icon size={16} />
                      {label}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
