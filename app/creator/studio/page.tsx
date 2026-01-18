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
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { NavHeader } from "@/components/nav-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { CenteredContainer } from "@/components/layouts/centered-container";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getProfile } from "@/lib/profile";
import { ensureProfile } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

// 延迟加载图表组件以提高首屏加载速度
const StudioChart = dynamic(
  () => import("@/components/studio-chart").then((mod) => mod.StudioChart),
  {
    loading: () => (
      <div className="w-full h-[300px] flex items-center justify-center bg-muted/50 rounded-lg">
        <Skeleton className="w-full h-full" />
      </div>
    ),
    ssr: false,
  }
);

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
      <div className="min-h-screen bg-background">
        {currentUser && <NavHeader user={currentUser!} notificationCount={0} />}
        <main className="py-6 sm:py-8 lg:py-12">
          <CenteredContainer maxWidth="7xl">
            <div className="space-y-8">
              <Skeleton className="h-8 w-64" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="rounded-xl border shadow-sm">
                    <CardContent className="pt-6">
                      <Skeleton className="h-12 w-12 rounded-lg mb-4" />
                      <Skeleton className="h-8 w-20 mb-2" />
                      <Skeleton className="h-4 w-24" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Skeleton className="h-64 rounded-xl" />
            </div>
          </CenteredContainer>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-ready">
      {currentUser && <NavHeader user={currentUser!} notificationCount={0} />}

      <main className="py-6 sm:py-8 lg:py-12">
        <CenteredContainer maxWidth="7xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-2">Creator Studio</h1>
              <p className="text-lg text-muted-foreground">
                Manage your content and track performance
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto rounded-xl min-h-[44px] transition-all duration-200"
            >
              <Link href="/creator/new-post">
                <Plus className="w-5 h-5 mr-2" aria-hidden="true" />
                New Post
              </Link>
            </Button>
          </div>

          {/* Time Range Filter */}
          <div className="flex gap-2 mb-8" role="tablist" aria-label="Time range filter">
            <Button
              variant={timeRange === "7d" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("7d")}
              className="rounded-xl transition-all duration-200"
              role="tab"
              aria-selected={timeRange === "7d"}
            >
              7 Days
            </Button>
            <Button
              variant={timeRange === "30d" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("30d")}
              className="rounded-xl transition-all duration-200"
              role="tab"
              aria-selected={timeRange === "30d"}
            >
              30 Days
            </Button>
            <Button
              variant={timeRange === "90d" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("90d")}
              className="rounded-xl transition-all duration-200"
              role="tab"
              aria-selected={timeRange === "90d"}
            >
              90 Days
            </Button>
          </div>

          {/* Stats Grid - 使用 StatCard 组件 */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8"
            data-testid="creator-stats"
          >
            <StatCard
              title="Total Revenue"
              value={`$${stats.revenue.value.toFixed(2)}`}
              change={{ value: stats.revenue.change, trend: stats.revenue.trend }}
              icon={<DollarSign className="w-5 h-5" aria-hidden="true" />}
            />
            <StatCard
              title="New Subscribers"
              value={stats.subscribers.value}
              change={{ value: stats.subscribers.change, trend: stats.subscribers.trend }}
              icon={<Users className="w-5 h-5" aria-hidden="true" />}
            />
            <StatCard
              title="PPV Sales"
              value={stats.ppvSales.value}
              change={{ value: stats.ppvSales.change, trend: stats.ppvSales.trend }}
              icon={<DollarSign className="w-5 h-5" aria-hidden="true" />}
            />
            <StatCard
              title="Visitors"
              value={stats.visitors.value.toLocaleString()}
              change={{ value: stats.visitors.change, trend: stats.visitors.trend }}
              icon={<Eye className="w-5 h-5" aria-hidden="true" />}
            />
          </div>

          {/* Chart - 平滑面积图，渐变紫色线条（延迟加载） */}
          <Card className="rounded-xl border shadow-sm mb-8">
            <CardHeader>
              <CardTitle className="text-xl">Revenue & Subscribers</CardTitle>
            </CardHeader>
            <CardContent>
              <StudioChart data={chartData} />
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8"
            data-testid="creator-nav"
          >
            <Button
              asChild
              variant="outline"
              className="h-auto py-4 rounded-xl min-h-[44px] transition-all duration-200"
            >
              <Link href="/creator/studio/analytics" className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5" aria-hidden="true" />
                <div className="text-left">
                  <p className="font-semibold">Analytics</p>
                  <p className="text-xs text-muted-foreground">Detailed performance metrics</p>
                </div>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="h-auto py-4 rounded-xl min-h-[44px] transition-all duration-200"
            >
              <Link href="/creator/studio/subscribers" className="flex items-center gap-3">
                <Users className="w-5 h-5" aria-hidden="true" />
                <div className="text-left">
                  <p className="font-semibold">Subscribers</p>
                  <p className="text-xs text-muted-foreground">Manage your subscriber base</p>
                </div>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="h-auto py-4 rounded-xl min-h-[44px] transition-all duration-200"
            >
              <Link href="/creator/studio/earnings" className="flex items-center gap-3">
                <DollarSign className="w-5 h-5" aria-hidden="true" />
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
              <Button asChild variant="ghost" size="sm" className="transition-all duration-200">
                <Link href="/creator/studio/post/list">View All</Link>
              </Button>
            </div>

            <div className="space-y-4">
              {recentPosts.map((post) => (
                <Card
                  key={post.id}
                  className="rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-all duration-200"
                >
                  <div className="flex flex-col md:flex-row">
                    {/* Media Preview */}
                    <div className="relative bg-muted md:w-48 aspect-video md:aspect-auto">
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
                          <Eye className="w-4 h-4" aria-hidden="true" />
                          {post.views.toLocaleString()} views
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Heart className="w-4 h-4" aria-hidden="true" />
                          {post.likes} likes
                        </div>
                        {post.revenue > 0 && (
                          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <DollarSign className="w-4 h-4" aria-hidden="true" />${post.revenue}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 md:p-6 flex md:flex-col gap-2 border-t md:border-t-0 md:border-l border-border">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 md:flex-none rounded-xl min-h-[40px] transition-all duration-200"
                        aria-label="Edit post"
                        disabled
                        title="Coming soon"
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 md:flex-none rounded-xl min-h-[40px] transition-all duration-200"
                        aria-label="View post"
                        asChild
                      >
                        <Link href={`/posts/${post.id}`}>View</Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </CenteredContainer>
      </main>
    </div>
  );
}
