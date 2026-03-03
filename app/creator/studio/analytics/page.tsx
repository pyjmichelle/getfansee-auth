"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Eye,
  Heart,
  DollarSign,
  ChevronRight,
  BarChart3,
  Users,
  TrendingUp,
  FileText,
  Plus,
} from "@/lib/icons";
import { PageShell } from "@/components/page-shell";
import Image from "next/image";
import Link from "next/link";
import { useCountUp } from "@/hooks/use-count-up";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { DEFAULT_AVATAR_CREATOR } from "@/lib/image-fallbacks";

type TimeRange = "7d" | "30d" | "90d" | "all";

function AnalyticsSkeleton() {
  return (
    <div className="pb-12 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48 rounded" />
            <Skeleton className="h-4 w-64 rounded" />
          </div>
        </div>
        <Skeleton className="h-10 w-64 rounded-xl" />
      </div>
      <div className="bento-grid">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
      <div className="card-block p-6">
        <Skeleton className="h-6 w-48 mb-6 rounded" />
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 min-w-[280px] rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [isLoading, setIsLoading] = useState(true);

  const currentUser = {
    username: "sophia_creative",
    role: "creator" as const,
    avatar: DEFAULT_AVATAR_CREATOR,
  };

  const animatedViews = useCountUp(12543, { duration: 900, decimals: 0 });
  const animatedViewers = useCountUp(8234, { duration: 900, decimals: 0 });
  const animatedEngagement = useCountUp(4.2, { duration: 900, decimals: 1 });
  const animatedNewSubs = useCountUp(234, { duration: 900, decimals: 0 });
  const animatedChurn = useCountUp(2.1, { duration: 900, decimals: 1 });
  const animatedEarnings = useCountUp(2847, { duration: 900, decimals: 0 });

  const topPosts = [
    {
      id: "1",
      title: "Behind the scenes of my latest shoot",
      views: 3245,
      likes: 892,
      earnings: "$234",
      thumbnail: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400",
    },
    {
      id: "2",
      title: "Exclusive tutorial: Advanced techniques",
      views: 2891,
      likes: 765,
      earnings: "$198",
      thumbnail: "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=400",
    },
    {
      id: "3",
      title: "Q&A session with subscribers",
      views: 2456,
      likes: 643,
      earnings: "$156",
      thumbnail: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400",
    },
  ];

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  // Chart data for views
  const viewsData = [420, 380, 520, 480, 650, 590, 720, 680, 820, 760, 890, 950, 880, 1020];
  const maxViews = Math.max(...viewsData);

  // Subscriber growth data
  const subscriberData = [
    45, 52, 48, 61, 58, 69, 72, 68, 78, 82, 89, 95, 103, 98, 112, 118, 125, 132, 138, 145, 152, 148,
    161, 168, 175, 182, 189, 196, 203, 210,
  ];
  const maxSubscribers = Math.max(...subscriberData);

  if (isLoading) {
    return (
      <PageShell user={currentUser} notificationCount={0} maxWidth="6xl">
        <AnalyticsSkeleton />
      </PageShell>
    );
  }

  const studioNav = [
    { href: "/creator/new-post", icon: Plus, label: "Create Post" },
    { href: "/creator/studio/earnings", icon: DollarSign, label: "Earnings" },
    { href: "/creator/studio/subscribers", icon: Users, label: "Subscribers" },
    { href: "/creator/studio/post/list", icon: FileText, label: "Post List" },
    { href: "/creator/studio/analytics", icon: BarChart3, label: "Analytics" },
  ];

  return (
    <PageShell user={currentUser} notificationCount={0} maxWidth="6xl">
      <div className="pb-12 flex flex-col lg:flex-row gap-8">
        <main className="flex-1 min-w-0" data-testid="analytics-ready">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <Link
                href="/creator/studio"
                className="p-2.5 hover:bg-surface-raised rounded-xl transition-colors active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
                aria-label="Back to Studio"
              >
                <ArrowLeft size={24} />
              </Link>
              <div>
                <h1 className="text-3xl font-bold mb-2 text-text-primary">Analytics</h1>
                <p className="text-text-tertiary">
                  Understand your audience and content performance
                </p>
              </div>
            </div>

            {/* Time Range Selector */}
            <div className="snap-row bg-surface-base border border-border-base rounded-xl p-1">
              {[
                { value: "7d" as const, label: "7 Days" },
                { value: "30d" as const, label: "30 Days" },
                { value: "90d" as const, label: "90 Days" },
                { value: "all" as const, label: "All Time" },
              ].map((range) => (
                <Button
                  key={range.value}
                  onClick={() => setTimeRange(range.value)}
                  variant={timeRange === range.value ? "default" : "ghost"}
                  size="sm"
                  className={`rounded-lg ${
                    timeRange === range.value
                      ? "bg-brand-primary text-white shadow-md"
                      : "text-text-secondary hover:bg-surface-raised"
                  }`}
                >
                  {range.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Analytics data is coming soon — current figures are estimates for preview purposes.
          </div>

          {/* Key Metrics - StatCard */}
          <div className="bento-grid mb-8">
            <StatCard
              title="Views"
              value={animatedViews.toFixed(0)}
              change={{ value: 12.5, trend: "up" }}
              icon={<Eye className="w-5 h-5" />}
              className="bento-2x1"
            />
            <StatCard
              title="Unique Viewers"
              value={animatedViewers.toFixed(0)}
              change={{ value: 8.2, trend: "up" }}
              icon={<Users className="w-5 h-5" />}
            />
            <StatCard
              title="Engagement Rate"
              value={`${animatedEngagement.toFixed(1)}%`}
              change={{ value: 0.3, trend: "down" }}
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <StatCard
              title="New Subscribers"
              value={animatedNewSubs.toFixed(0)}
              change={{ value: 18.7, trend: "up" }}
              icon={<Users className="w-5 h-5" />}
            />
            <StatCard
              title="Churn Rate"
              value={`${animatedChurn.toFixed(1)}%`}
              change={{ value: 0.5, trend: "down" }}
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <StatCard
              title="Earnings"
              value={`$${animatedEarnings.toFixed(0)}`}
              change={{ value: 22.1, trend: "up" }}
              icon={<DollarSign className="w-5 h-5" />}
              className="bento-2x1"
            />
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-surface-base border border-border-base rounded-2xl p-6">
              <h3 className="font-semibold text-lg mb-6 text-text-primary">Views Over Time</h3>
              <div className="h-64 flex items-end justify-between gap-2">
                {viewsData.map((height, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-brand-primary/20 hover:bg-brand-primary/40 rounded-t transition-all cursor-pointer relative group"
                    style={{ height: `${(height / maxViews) * 100}%` }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-overlay border border-border-strong rounded px-2 py-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {height} views
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-4 text-xs text-text-tertiary">
                <span>2 weeks ago</span>
                <span>Today</span>
              </div>
            </div>

            <div className="bg-surface-base border border-border-base rounded-2xl p-6">
              <h3 className="font-semibold text-lg mb-6 text-text-primary">Revenue Breakdown</h3>
              <div className="flex items-center justify-center h-64">
                <div className="relative w-48 h-48">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="var(--brand-primary)"
                      strokeWidth="20"
                      strokeDasharray="163 251"
                      transform="rotate(-90 50 50)"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="var(--brand-accent)"
                      strokeWidth="20"
                      strokeDasharray="75 251"
                      strokeDashoffset="-163"
                      transform="rotate(-90 50 50)"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="var(--success)"
                      strokeWidth="20"
                      strokeDasharray="13 251"
                      strokeDashoffset="-238"
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-3xl font-bold text-text-primary">$2,847</div>
                    <div className="text-sm text-text-tertiary">Total</div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-brand-primary" />
                    <span className="text-sm text-text-secondary">Subscriptions</span>
                  </div>
                  <span className="font-semibold text-text-primary">$1,851 (65%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-brand-accent" />
                    <span className="text-sm text-text-secondary">PPV Sales</span>
                  </div>
                  <span className="font-semibold text-text-primary">$854 (30%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-success" />
                    <span className="text-sm text-text-secondary">Tips</span>
                  </div>
                  <span className="font-semibold text-text-primary">$142 (5%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Subscribers Growth */}
          <div className="bg-surface-base border border-border-base rounded-2xl p-6 mb-8">
            <h3 className="font-semibold text-lg mb-6 text-text-primary">Subscriber Growth</h3>
            <div className="h-48 flex items-end justify-between gap-1">
              {subscriberData.map((value, i) => (
                <div
                  key={i}
                  className="flex-1 bg-success/30 rounded-t transition-all hover:bg-success/50"
                  style={{ height: `${(value / maxSubscribers) * 100}%` }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-text-tertiary">Last 30 days</span>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-success rounded-full" />
                  <span className="text-text-tertiary">
                    New: <span className="font-semibold text-text-primary">234</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-error rounded-full" />
                  <span className="text-text-tertiary">
                    Churned: <span className="font-semibold text-text-primary">24</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Performing Content */}
          <div className="card-block p-6">
            <h3 className="font-semibold text-lg mb-6 text-text-primary">Top Performing Content</h3>
            {topPosts.length === 0 ? (
              <EmptyState
                icon={<BarChart3 className="w-8 h-8 text-text-tertiary" />}
                title="No content yet"
                description="Publish posts to see performance and top content here."
                action={{ label: "Create Post", href: "/creator/new-post" }}
              />
            ) : (
              <div className="snap-row">
                {topPosts.map((post, index) => (
                  <div
                    key={post.id}
                    className="card-block min-w-[280px] flex items-center gap-4 p-4 hover:bg-surface-overlay transition-all cursor-pointer animate-profile-reveal"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div className="text-2xl font-bold text-text-quaternary w-8 text-center">
                      #{index + 1}
                    </div>
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-surface-base">
                      <Image
                        src={post.thumbnail}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold mb-1 truncate text-text-primary">
                        {post.title}
                      </h4>
                      <div className="flex items-center gap-4 text-sm text-text-tertiary">
                        <span className="flex items-center gap-1">
                          <Eye size={14} />
                          {post.views.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart size={14} />
                          {post.likes}
                        </span>
                        <span className="flex items-center gap-1 text-success font-medium">
                          <DollarSign size={14} />
                          {post.earnings}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-lg hover:bg-surface-base"
                      aria-label="View post"
                    >
                      <ChevronRight size={20} className="text-text-tertiary" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Sidebar: Studio nav (PC only) */}
        <aside className="w-full lg:w-72 shrink-0">
          <div className="sticky top-24 space-y-4">
            <div className="card-block p-4">
              <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                Studio
              </h2>
              <nav className="space-y-1" aria-label="Studio navigation">
                {studioNav.map(({ href, icon: Icon, label }) => {
                  const isActive = href === "/creator/studio/analytics";
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary ${
                        isActive
                          ? "bg-brand-primary/10 text-brand-primary"
                          : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                      }`}
                    >
                      <Icon size={16} />
                      {label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
