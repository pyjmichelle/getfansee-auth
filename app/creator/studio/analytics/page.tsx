"use client";

/**
 * Creator Studio Analytics (Pre-Payment Alpha — real data).
 *
 * All figures come from /api/creator/analytics (profile views, followers,
 * saves, external link clicks, top posts by likes). Revenue lives on the
 * Earnings page; Alpha analytics focuses on the discovery funnel.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Heart, BarChart3, Users, Bookmark, ExternalLink } from "@/lib/icons";
import { PageShell } from "@/components/page-shell";
import { StudioShell } from "@/components/shells/studio-shell";
import Image from "next/image";
import Link from "next/link";
import { useCountUp } from "@/hooks/use-count-up";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { DEFAULT_POST_MEDIA } from "@/lib/image-fallbacks";

type TimeRange = "7d" | "30d" | "90d";

interface SeriesPoint {
  day: string;
  views?: number;
  follows?: number;
}

interface TopPost {
  id: string;
  title: string;
  likes: number;
  visibility: string;
  price_cents: number;
  thumbnail: string | null;
}

interface AnalyticsData {
  profileViews: { total: number; series: { day: string; views: number }[] };
  followers: { total: number; new: number; series: { day: string; follows: number }[] };
  saves: number;
  linkClicks: number;
  topPosts: TopPost[];
}

function AnalyticsSkeleton() {
  return (
    <div className="pb-24 space-y-8">
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
    </div>
  );
}

function BarChart({
  points,
  getValue,
  colorClass,
  unit,
}: {
  points: SeriesPoint[];
  getValue: (p: SeriesPoint) => number;
  colorClass: string;
  unit: string;
}) {
  const max = Math.max(1, ...points.map(getValue));
  return (
    <div className="h-56 flex items-end justify-between gap-1">
      {points.map((point, i) => {
        const value = getValue(point);
        return (
          <div
            key={i}
            className={`flex-1 rounded-t transition-all cursor-default relative group ${colorClass}`}
            style={{ height: `${Math.max(2, (value / max) * 100)}%` }}
          >
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-overlay border border-border-strong rounded px-2 py-1 text-tiny font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              {value} {unit} · {point.day.slice(5)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const auth = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  // `initialLoading` only covers the very first load (no shell to show yet).
  // `isFetching` covers subsequent time-range switches: the header + time
  // range selector + previous data stay mounted (keep-previous-data) so the
  // page never collapses back to a full skeleton, which was the single
  // biggest layout-jump offender in this app.
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);

  useEffect(() => {
    if (!auth.authenticated || !auth.user) {
      router.push("/auth");
      return;
    }
    if (auth.profile?.role !== "creator") {
      router.push("/home");
      return;
    }
    setCurrentUser({
      username: auth.profile?.display_name || auth.user.email.split("@")[0] || "creator",
      role: "creator",
      avatar: auth.profile?.avatar_url || undefined,
    });

    const controller = new AbortController();
    const load = async () => {
      try {
        setIsFetching(true);
        setLoadError(false);

        const response = await fetch(`/api/creator/analytics?range=${timeRange}`, {
          signal: controller.signal,
        });
        if (response.ok) {
          const json = await response.json();
          if (json.success) {
            setData(json.analytics);
          } else {
            setLoadError(true);
          }
        } else {
          setLoadError(true);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("[analytics] load error:", err);
          setLoadError(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsFetching(false);
          setInitialLoading(false);
        }
      }
    };

    load();
    return () => controller.abort();
  }, [router, timeRange, retryNonce, auth.authenticated, auth.user, auth.profile]);

  const animatedViews = useCountUp(data?.profileViews.total ?? 0, { duration: 900, decimals: 0 });
  const animatedFollowers = useCountUp(data?.followers.total ?? 0, { duration: 900, decimals: 0 });
  const animatedNewFollowers = useCountUp(data?.followers.new ?? 0, {
    duration: 900,
    decimals: 0,
  });
  const animatedSaves = useCountUp(data?.saves ?? 0, { duration: 900, decimals: 0 });
  const animatedClicks = useCountUp(data?.linkClicks ?? 0, { duration: 900, decimals: 0 });

  if (initialLoading) {
    return (
      <PageShell user={currentUser} notificationCount={0} maxWidth="6xl">
        <AnalyticsSkeleton />
      </PageShell>
    );
  }

  const viewsSeries = data?.profileViews.series ?? [];
  const followsSeries = data?.followers.series ?? [];
  const topPosts = data?.topPosts ?? [];

  return (
    <PageShell user={currentUser} notificationCount={0} maxWidth="6xl">
      <div className="pb-24 overflow-x-hidden">
        <StudioShell>
          <div
            data-testid="analytics-ready"
            className={`overflow-x-hidden transition-opacity duration-150 ${isFetching ? "opacity-60" : "opacity-100"}`}
          >
            {/* Header */}
            <div
              data-testid="analytics-header"
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
            >
              <div className="flex items-center gap-4">
                <Link
                  href="/creator/studio"
                  className="p-2.5 hover:bg-surface-raised rounded-xl transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--wine)]"
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
                ].map((range) => (
                  <Button
                    key={range.value}
                    onClick={() => setTimeRange(range.value)}
                    variant={timeRange === range.value ? "default" : "ghost"}
                    size="sm"
                    className={`min-h-11 rounded-lg ${
                      timeRange === range.value
                        ? "bg-[var(--wine)] text-white shadow-md"
                        : "text-text-secondary hover:bg-surface-raised"
                    }`}
                  >
                    {range.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="mb-6 rounded-xl border border-border-base bg-surface-raised px-4 py-3 text-small text-text-tertiary">
              Alpha analytics tracks your discovery funnel: profile views → follows/saves → external
              link clicks. Revenue details live on the{" "}
              <Link href="/creator/studio/earnings" className="text-wine-text underline">
                Earnings page
              </Link>
              .
            </div>

            {loadError && (
              <div className="mb-6 rounded-xl border border-[var(--error)]/40 bg-[var(--error)]/10 px-4 py-3 text-small text-error-text flex items-center justify-between gap-4">
                <span>
                  Couldn&apos;t refresh analytics for this range. Showing the last data loaded.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRetryNonce((n) => n + 1)}
                  className="shrink-0"
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Key Metrics — real data */}
            <div className="bento-grid mb-8">
              <StatCard
                title="Profile Views"
                value={animatedViews.toFixed(0)}
                description={`Last ${timeRange === "7d" ? "7" : timeRange === "30d" ? "30" : "90"} days`}
                icon={<Eye className="w-5 h-5" />}
                className="bento-2x1"
              />
              <StatCard
                title="Followers"
                value={animatedFollowers.toFixed(0)}
                description="All time"
                icon={<Users className="w-5 h-5" />}
              />
              <StatCard
                title="New Followers"
                value={animatedNewFollowers.toFixed(0)}
                description="In selected range"
                icon={<Users className="w-5 h-5" />}
              />
              <StatCard
                title="Saves"
                value={animatedSaves.toFixed(0)}
                description="Fans who bookmarked you"
                icon={<Bookmark className="w-5 h-5" />}
              />
              <StatCard
                title="Link Clicks"
                value={animatedClicks.toFixed(0)}
                description="Outbound clicks on your links"
                icon={<ExternalLink className="w-5 h-5" />}
                className="bento-2x1"
              />
            </div>

            {/* Charts Row — real series */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-surface-base border border-border-base rounded-2xl p-6">
                <h3 className="font-semibold text-lg mb-6 text-text-primary">Profile Views</h3>
                {viewsSeries.every((p) => p.views === 0) ? (
                  <div className="h-56 flex items-center justify-center text-small text-text-tertiary">
                    No views recorded in this range yet.
                  </div>
                ) : (
                  <BarChart
                    points={viewsSeries}
                    getValue={(p) => p.views ?? 0}
                    colorClass="bg-[var(--wine)]/25 hover:bg-[var(--wine)]/45"
                    unit="views"
                  />
                )}
                <div className="flex justify-between mt-4 text-tiny text-text-tertiary">
                  <span>{viewsSeries[0]?.day ?? ""}</span>
                  <span>Today</span>
                </div>
              </div>

              <div className="bg-surface-base border border-border-base rounded-2xl p-6">
                <h3 className="font-semibold text-lg mb-6 text-text-primary">New Follows</h3>
                {followsSeries.every((p) => p.follows === 0) ? (
                  <div className="h-56 flex items-center justify-center text-small text-text-tertiary">
                    No new follows in this range yet.
                  </div>
                ) : (
                  <BarChart
                    points={followsSeries}
                    getValue={(p) => p.follows ?? 0}
                    colorClass="bg-success/30 hover:bg-success/50"
                    unit="follows"
                  />
                )}
                <div className="flex justify-between mt-4 text-tiny text-text-tertiary">
                  <span>{followsSeries[0]?.day ?? ""}</span>
                  <span>Today</span>
                </div>
              </div>
            </div>

            {/* Top Content by likes — real data */}
            <div className="card-block p-6 overflow-hidden">
              <h3 className="font-semibold text-lg mb-6 text-text-primary">Top Content by Likes</h3>
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
                      className="card-block min-w-[280px] flex items-center gap-4 p-4 hover:bg-surface-overlay transition-all animate-profile-reveal"
                      style={{ animationDelay: `${index * 80}ms` }}
                    >
                      <div className="text-2xl font-bold text-text-quaternary w-8 text-center">
                        #{index + 1}
                      </div>
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-surface-base">
                        <Image
                          src={post.thumbnail || DEFAULT_POST_MEDIA}
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
                        <div className="flex items-center gap-4 text-small text-text-tertiary">
                          <span className="flex items-center gap-1">
                            <Heart size={14} />
                            {post.likes.toLocaleString()}
                          </span>
                          <span className="capitalize">{post.visibility}</span>
                          {post.visibility === "ppv" && post.price_cents > 0 && (
                            <span className="text-success font-medium">
                              ${(post.price_cents / 100).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="rounded-lg hover:bg-surface-base"
                      >
                        <Link href={`/posts/${post.id}`} aria-label="View post">
                          <Eye size={20} className="text-text-tertiary" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </StudioShell>
      </div>
    </PageShell>
  );
}
