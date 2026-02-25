"use client";

import { useState, useEffect } from "react";
import { DollarSign, Users, Eye, Heart, Plus, MessageCircle, Coins } from "lucide-react";
import { NavHeader } from "@/components/nav-header";
// Card, Badge, Skeleton, StatCard, CenteredContainer no longer needed - using Figma inline styles
import { BottomNavigation } from "@/components/bottom-navigation";
// EmptyState no longer needed - using Figma inline styles
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getProfile } from "@/lib/profile";
import { ensureProfile } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

// 延迟加载图表组件以提高首屏加载速度
const _StudioChart = dynamic(
  () => import("@/components/studio-chart").then((mod) => mod.StudioChart),
  {
    loading: () => (
      <div className="w-full h-[300px] flex items-center justify-center bg-surface-raised rounded-lg animate-pulse" />
    ),
    ssr: false,
  }
);

const supabase = getSupabaseBrowserClient();

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

  const [stats, setStats] = useState({
    revenue: { value: 0, change: 0, trend: "up" as "up" | "down" },
    subscribers: { value: 0, change: 0, trend: "up" as "up" | "down" },
    ppvSales: { value: 0, change: 0, trend: "up" as "up" | "down" },
    visitors: { value: 0, change: 0, trend: "up" as "up" | "down" },
  });

  const [_chartData, _setChartData] = useState<
    Array<{ date: string; revenue: number; subscribers: number }>
  >([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/auth");
          return;
        }

        await ensureProfile();
        setCurrentUserId(session.user.id);

        const profile = await getProfile(session.user.id);
        if (profile) {
          setCurrentUser({
            username: profile.display_name || "user",
            role: (profile.role || "fan") as "fan" | "creator",
            avatar: profile.avatar_url || undefined,
          });

          if (profile.role !== "creator") {
            router.push("/home");
            return;
          }
        }

        // 加载真实统计数据
        await loadStats();
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
      const response = await fetch(
        `/api/creator/stats?timeRange=${_timeRange}&includeChart=true&includePosts=false`
      );
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
        if (data.chartData) {
          _setChartData(data.chartData);
        }
      }
    } catch (err) {
      console.error("[studio] loadStats error:", err);
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

  // 加载最近的帖子
  useEffect(() => {
    const loadRecentPosts = async () => {
      if (!currentUserId) return;

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

    loadRecentPosts();
  }, [currentUserId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        {currentUser && <NavHeader user={currentUser!} notificationCount={0} />}
        <div className="pt-20 md:pt-24 px-4 md:px-6 max-w-5xl mx-auto pb-12">
          <div className="space-y-8 animate-pulse">
            <div className="h-8 w-64 bg-surface-raised rounded" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-surface-raised rounded-xl p-5 h-32" />
              ))}
            </div>
            <div className="h-64 bg-surface-raised rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0" data-testid="page-ready">
      {currentUser && <NavHeader user={currentUser!} notificationCount={0} />}

      <div className="pt-20 md:pt-24 px-4 md:px-6 max-w-5xl mx-auto pb-12">
        {/* Header - Figma Style */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-text-primary">Dashboard</h1>
          <p className="text-text-tertiary">Track your performance and earnings</p>
        </div>

        {/* Quick Actions - Figma Style */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <Link
            href="/creator/new-post"
            className="px-6 py-4 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
          >
            <Plus size={22} />
            Create Post
          </Link>
          <Link
            href="/creator/studio/earnings"
            className="px-6 py-4 bg-surface-raised border border-border-base rounded-xl font-semibold hover:bg-surface-overlay transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <DollarSign size={22} />
            Earnings
          </Link>
        </div>

        {/* Key Stats - Figma Style */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" data-testid="creator-stats">
          <div className="bg-surface-base border border-border-base rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                <DollarSign size={20} className="text-success" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1 text-text-primary">
              ${stats.revenue.value.toFixed(0)}
            </div>
            <div className="text-sm text-text-tertiary">This month</div>
            <div className="text-xs text-success mt-2">
              +{stats.revenue.change}% from last month
            </div>
          </div>

          <div className="bg-surface-base border border-border-base rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-brand-primary-alpha-10 rounded-lg flex items-center justify-center">
                <Users size={20} className="text-brand-primary" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1 text-text-primary">
              {stats.subscribers.value.toLocaleString()}
            </div>
            <div className="text-sm text-text-tertiary">Subscribers</div>
            <div className="text-xs text-success mt-2">+{stats.subscribers.change} this month</div>
          </div>

          <div className="bg-surface-base border border-border-base rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                <Eye size={20} className="text-accent" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1 text-text-primary">
              {stats.visitors.value.toLocaleString()}
            </div>
            <div className="text-sm text-text-tertiary">Total views</div>
            <div className="text-xs text-success mt-2">
              +{stats.visitors.change}% from last month
            </div>
          </div>

          <div className="bg-surface-base border border-border-base rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-brand-secondary/10 rounded-lg flex items-center justify-center">
                <Heart size={20} className="text-brand-secondary" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1 text-text-primary">{stats.ppvSales.value}</div>
            <div className="text-sm text-text-tertiary">PPV Sales</div>
            <div className="text-xs text-success mt-2">
              +{stats.ppvSales.change}% from last month
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
                className="bg-surface-base border border-border-base rounded-xl overflow-hidden hover:border-brand-primary/30 transition-all cursor-pointer group"
              >
                <div className="relative aspect-video overflow-hidden bg-black">
                  <img
                    src={post.mediaUrl || "/placeholder.svg"}
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
        <div className="bg-surface-base border border-border-base rounded-xl p-6 mb-8">
          <h3 className="text-xl font-bold mb-6 text-text-primary">Revenue Breakdown</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-text-secondary">Subscriptions</span>
                <span className="font-bold text-text-primary">70%</span>
              </div>
              <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                <div className="h-full bg-brand-primary rounded-full" style={{ width: "70%" }} />
              </div>
              <div className="text-2xl font-bold mt-3 text-text-primary">
                ${(stats.revenue.value * 0.7).toFixed(0)}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-text-secondary">Unlocks</span>
                <span className="font-bold text-text-primary">18%</span>
              </div>
              <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full" style={{ width: "18%" }} />
              </div>
              <div className="text-2xl font-bold mt-3 text-text-primary">
                ${(stats.revenue.value * 0.18).toFixed(0)}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-text-secondary">Tips</span>
                <span className="font-bold text-text-primary">12%</span>
              </div>
              <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full"
                  style={{ width: "12%" }}
                />
              </div>
              <div className="text-2xl font-bold mt-3 text-text-primary">
                ${(stats.revenue.value * 0.12).toFixed(0)}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity - Figma Style */}
        <div className="bg-surface-base border border-border-base rounded-xl p-6">
          <h3 className="text-xl font-bold mb-4 text-text-primary">Recent Activity</h3>
          <div className="space-y-4">
            {[
              {
                icon: Users,
                text: "New subscriber joined",
                time: "5 min ago",
                color: "brand-primary",
              },
              { icon: Coins, text: "You received a tip", time: "12 min ago", color: "amber-500" },
              {
                icon: Heart,
                text: "Your post got 50+ new likes",
                time: "1 hour ago",
                color: "error",
              },
              {
                icon: MessageCircle,
                text: "New comment on your post",
                time: "2 hours ago",
                color: "brand-secondary",
              },
            ].map((activity, i) => {
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
                  className="flex items-center gap-4 p-3 hover:bg-surface-raised rounded-lg transition-colors"
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

      <BottomNavigation notificationCount={0} userRole={currentUser?.role} />
    </div>
  );
}
