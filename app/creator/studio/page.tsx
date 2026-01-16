"use client";

import { useState, useEffect } from "react";
import {
  DollarSign,
  Users,
  Eye,
  Heart,
  Plus,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { NavHeader } from "@/components/nav-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getProfile } from "@/lib/profile";
import { ensureProfile } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const supabase = getSupabaseBrowserClient();

export default function CreatorStudioPage() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
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

  const [chartData, setChartData] = useState<
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
        `/api/creator/stats?timeRange=${timeRange}&includeChart=true&includePosts=false`
      );
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
        if (data.chartData) {
          setChartData(data.chartData);
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
  }, [timeRange, currentUserId]);

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
      <div className="min-h-screen bg-[#050505]">
        {currentUser && <NavHeader user={currentUser} notificationCount={0} />}
        <main className="container max-w-6xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-8 w-64 bg-[#121212] rounded"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-[#121212] rounded-3xl"></div>
              ))}
            </div>
            <div className="h-64 bg-[#121212] rounded-3xl"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      {currentUser && <NavHeader user={currentUser} notificationCount={0} />}

      <main className="container max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Creator Studio</h1>
            <p className="text-muted-foreground">Manage your content and track performance</p>
          </div>
          <Button asChild variant="gradient" size="lg" className="w-full sm:w-auto rounded-xl">
            <Link href="/creator/new-post">
              <Plus className="w-5 h-5 mr-2" />
              New Post
            </Link>
          </Button>
        </div>

        {/* Time Range Filter */}
        <div className="flex gap-2 mb-8">
          <Button
            variant={timeRange === "7d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("7d")}
            className={`rounded-xl ${timeRange === "7d" ? "bg-primary-gradient" : "border-[#1F1F1F] bg-[#0D0D0D] hover:bg-[#1A1A1A]"}`}
          >
            7 Days
          </Button>
          <Button
            variant={timeRange === "30d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("30d")}
            className={`rounded-xl ${timeRange === "30d" ? "bg-primary-gradient" : "border-[#1F1F1F] bg-[#0D0D0D] hover:bg-[#1A1A1A]"}`}
          >
            30 Days
          </Button>
          <Button
            variant={timeRange === "90d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("90d")}
            className={`rounded-xl ${timeRange === "90d" ? "bg-primary-gradient" : "border-[#1F1F1F] bg-[#0D0D0D] hover:bg-[#1A1A1A]"}`}
          >
            90 Days
          </Button>
        </div>

        {/* Stats Grid - 四宫格数据 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#10B981]/10 text-[#10B981] flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
              <div
                className={`flex items-center gap-1 text-sm ${stats.revenue.trend === "up" ? "text-[#10B981]" : "text-[#F43F5E]"}`}
              >
                {stats.revenue.trend === "up" ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {Math.abs(stats.revenue.change)}%
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                ${stats.revenue.value.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Total Revenue</p>
            </div>
          </div>

          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div
                className={`flex items-center gap-1 text-sm ${stats.subscribers.trend === "up" ? "text-[#10B981]" : "text-[#F43F5E]"}`}
              >
                {stats.subscribers.trend === "up" ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {Math.abs(stats.subscribers.change)}%
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.subscribers.value}</p>
              <p className="text-sm text-muted-foreground mt-1">New Subs</p>
            </div>
          </div>

          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#A855F7]/10 text-[#A855F7] flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
              <div
                className={`flex items-center gap-1 text-sm ${stats.ppvSales.trend === "up" ? "text-[#10B981]" : "text-[#F43F5E]"}`}
              >
                {stats.ppvSales.trend === "up" ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {Math.abs(stats.ppvSales.change)}%
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.ppvSales.value}</p>
              <p className="text-sm text-muted-foreground mt-1">PPV Sales</p>
            </div>
          </div>

          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#EC4899]/10 text-[#EC4899] flex items-center justify-center">
                <Eye className="w-6 h-6" />
              </div>
              <div
                className={`flex items-center gap-1 text-sm ${stats.visitors.trend === "up" ? "text-[#10B981]" : "text-[#F43F5E]"}`}
              >
                {stats.visitors.trend === "up" ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {Math.abs(stats.visitors.change)}%
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {stats.visitors.value.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Visitors</p>
            </div>
          </div>
        </div>

        {/* Chart - 平滑面积图，渐变紫色线条 */}
        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-6 md:p-8 mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-6">Revenue & Subscribers</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#A855F7" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#A855F7" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSubscribers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
              <XAxis dataKey="date" stroke="#999999" />
              <YAxis stroke="#999999" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0D0D0D",
                  border: "1px solid #1F1F1F",
                  borderRadius: "12px",
                  color: "#E5E5E5",
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#A855F7"
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
              <Area
                type="monotone"
                dataKey="subscribers"
                stroke="#6366F1"
                fillOpacity={1}
                fill="url(#colorSubscribers)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <Button
            asChild
            variant="outline"
            className="h-auto py-4 border-[#1F1F1F] bg-[#0D0D0D] hover:bg-[#1A1A1A] rounded-xl"
          >
            <Link href="/creator/studio/analytics" className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5" />
              <div className="text-left">
                <p className="font-semibold">Analytics</p>
                <p className="text-xs text-muted-foreground">Detailed performance metrics</p>
              </div>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-auto py-4 border-[#1F1F1F] bg-[#0D0D0D] hover:bg-[#1A1A1A] rounded-xl"
          >
            <Link href="/creator/studio/subscribers" className="flex items-center gap-3">
              <Users className="w-5 h-5" />
              <div className="text-left">
                <p className="font-semibold">Subscribers</p>
                <p className="text-xs text-muted-foreground">Manage your subscriber base</p>
              </div>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-auto py-4 border-[#1F1F1F] bg-[#0D0D0D] hover:bg-[#1A1A1A] rounded-xl"
          >
            <Link href="/creator/studio/earnings" className="flex items-center gap-3">
              <DollarSign className="w-5 h-5" />
              <div className="text-left">
                <p className="font-semibold">Earnings</p>
                <p className="text-xs text-muted-foreground">View revenue and payouts</p>
              </div>
            </Link>
          </Button>
        </div>

        {/* Recent Posts */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Recent Posts</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/creator/studio/post/list">View All</Link>
            </Button>
          </div>

          <div className="space-y-4">
            {recentPosts.map((post) => (
              <div
                key={post.id}
                className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl overflow-hidden"
              >
                <div className="flex flex-col md:flex-row">
                  {/* Media Preview */}
                  <div className="relative bg-[#121212] md:w-48 aspect-video md:aspect-auto">
                    <img
                      src={post.mediaUrl || "/placeholder.svg"}
                      alt="Post preview"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Post Details */}
                  <div className="flex-1 p-4 md:p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant={post.type === "free" ? "secondary" : "default"}
                            className="rounded-lg"
                          >
                            {post.type === "free"
                              ? "Free"
                              : post.type === "subscribers"
                                ? "Subscribers"
                                : `$${post.price}`}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(post.createdAt)}
                          </span>
                        </div>
                        <p className="text-foreground mb-3">{post.content}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-6 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Eye className="w-4 h-4" />
                        {post.views.toLocaleString()} views
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Heart className="w-4 h-4" />
                        {post.likes} likes
                      </div>
                      {post.revenue > 0 && (
                        <div className="flex items-center gap-1 text-[#10B981]">
                          <DollarSign className="w-4 h-4" />${post.revenue}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 md:p-6 flex md:flex-col gap-2 border-t md:border-t-0 md:border-l border-[#1F1F1F]">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 md:flex-none border-[#1F1F1F] bg-[#0D0D0D] hover:bg-[#1A1A1A] rounded-xl"
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="flex-1 md:flex-none rounded-xl">
                      View
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
