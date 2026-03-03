"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  Calendar,
  MoreVertical,
  Users,
  Plus,
  DollarSign,
  BarChart3,
  FileText,
} from "@/lib/icons";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { DEFAULT_AVATAR_FAN } from "@/lib/image-fallbacks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// listSubscribers 通过 API 调用，不直接导入
import Link from "next/link";
import { format } from "date-fns";
import { useCountUp } from "@/hooks/use-count-up";
import { getAuthBootstrap } from "@/lib/auth-bootstrap-client";
import { useSkeletonMetric } from "@/hooks/use-skeleton-metric";

interface Subscriber {
  id: string;
  fan_id: string;
  fan_display_name: string | null;
  fan_avatar_url: string | null;
  status: string;
  starts_at: string;
  ends_at: string;
  cancelled_at: string | null;
  created_at: string;
}

export default function SubscribersPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "will_cancel" | "canceled">("all");
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  useSkeletonMetric("creator_subscribers_page", isLoading);

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
        setCurrentUser({
          username: bootstrap.profile?.display_name || bootstrap.user.email.split("@")[0] || "user",
          role: "creator",
          avatar: bootstrap.profile?.avatar_url || undefined,
        });

        // 加载订阅者列表（通过 API）
        const response = await fetch("/api/paywall/subscribers");
        if (response.ok) {
          const data = await response.json();
          setSubscribers(data.subscribers || []);
        } else {
          console.error("[subscribers] Failed to fetch subscribers");
        }
      } catch (err) {
        console.error("[subscribers] loadData error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router]);

  const getSubscriberStatus = (sub: Subscriber): "active" | "will_cancel" | "canceled" => {
    if (sub.status === "canceled" || sub.cancelled_at) {
      return "canceled";
    }
    // 检查是否即将到期（7天内）
    const endsAt = new Date(sub.ends_at);
    const now = new Date();
    const daysUntilEnd = Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilEnd <= 7 && daysUntilEnd > 0) {
      return "will_cancel";
    }
    return "active";
  };

  const filteredSubscribers = subscribers.filter((sub) => {
    const matchesSearch =
      sub.fan_display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.fan_id.toLowerCase().includes(searchQuery.toLowerCase());
    const status = getSubscriberStatus(sub);
    const matchesFilter = filter === "all" || status === filter;
    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy");
  };

  const getStatusBadge = (status: "active" | "will_cancel" | "canceled") => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-success/10 text-success border-success/20 rounded-lg">Active</Badge>
        );
      case "will_cancel":
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20 rounded-lg">
            Expiring Soon
          </Badge>
        );
      case "canceled":
        return (
          <Badge className="bg-error/10 text-error border-error/20 rounded-lg">Cancelled</Badge>
        );
      default:
        return null;
    }
  };

  const activeCount = subscribers.filter((s) => getSubscriberStatus(s) === "active").length;
  const willCancelCount = subscribers.filter(
    (s) => getSubscriberStatus(s) === "will_cancel"
  ).length;
  const animatedTotal = useCountUp(subscribers.length, { duration: 900, decimals: 0 });
  const animatedActive = useCountUp(activeCount, { duration: 900, decimals: 0 });
  const animatedExpiring = useCountUp(willCancelCount, { duration: 900, decimals: 0 });

  if (isLoading) {
    return (
      <PageShell user={currentUser} notificationCount={0} maxWidth="6xl">
        <div className="py-8 animate-pulse space-y-4">
          <div className="h-8 w-48 bg-surface-raised rounded mb-2" />
          <div className="h-4 w-64 bg-surface-raised rounded mb-6" />
          <div className="bento-grid mb-6">
            <div className="bento-2x1 h-24 bg-surface-raised rounded-2xl" />
            <div className="h-24 bg-surface-raised rounded-2xl" />
            <div className="h-24 bg-surface-raised rounded-2xl" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-surface-raised rounded-2xl" />
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell user={currentUser} notificationCount={0} maxWidth="6xl">
      <div className="py-8 flex flex-col lg:flex-row gap-8">
        <main className="flex-1 min-w-0" data-testid="subscribers-list">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-6 border-border-base bg-surface-base hover:bg-surface-raised rounded-xl active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <Link href="/creator/studio">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Studio
            </Link>
          </Button>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-text-primary mb-2">My Subscribers</h1>
            <p className="text-text-tertiary">Manage your fanbase and track subscriber activity</p>
          </div>

          {/* Stats Overview - StatCard */}
          <div className="bento-grid mb-8">
            <StatCard
              title="Total Subscribers"
              value={animatedTotal.toFixed(0)}
              icon={<Users className="w-5 h-5" />}
              className="bento-2x1"
            />
            <StatCard
              title="Active"
              value={animatedActive.toFixed(0)}
              valueClassName="text-success"
              icon={<Users className="w-5 h-5" />}
            />
            <StatCard
              title="Expiring Soon"
              value={animatedExpiring.toFixed(0)}
              valueClassName="text-brand-secondary"
              icon={<Calendar className="w-5 h-5" />}
            />
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <Input
                placeholder="Search subscribers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11 bg-surface-base border-border-base rounded-xl"
              />
            </div>
            <div className="snap-row">
              {(["all", "active", "will_cancel", "canceled"] as const).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(f)}
                  className={`rounded-xl active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary ${
                    filter === f
                      ? "bg-brand-primary text-white"
                      : "border-border-base bg-surface-base hover:bg-surface-raised"
                  }`}
                >
                  {f === "all"
                    ? "All"
                    : f === "active"
                      ? "Active"
                      : f === "will_cancel"
                        ? "Expiring"
                        : "Cancelled"}
                </Button>
              ))}
            </div>
          </div>

          {/* Subscribers List */}
          {filteredSubscribers.length === 0 ? (
            <EmptyState
              icon={<Users className="w-8 h-8 text-text-tertiary" />}
              title="No subscribers found"
              description={
                searchQuery || filter !== "all"
                  ? "Try a different search or filter."
                  : "When fans subscribe to you they will appear here."
              }
              action={{ label: "Back to Studio", href: "/creator/studio" }}
              className="card-block p-12"
            />
          ) : (
            <div className="space-y-3">
              {filteredSubscribers.map((subscriber, index) => {
                const status = getSubscriberStatus(subscriber);
                const displayName =
                  subscriber.fan_display_name || `User ${subscriber.fan_id.slice(0, 8)}`;

                return (
                  <div
                    key={subscriber.id}
                    className="card-block p-4 md:p-6 animate-profile-reveal"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={subscriber.fan_avatar_url || DEFAULT_AVATAR_FAN} />
                        <AvatarFallback className="bg-brand-primary-alpha-10 text-brand-primary">
                          {displayName[0]?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-text-primary">{displayName}</p>
                          {getStatusBadge(status)}
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-text-tertiary">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Started {formatDate(subscriber.starts_at)}
                          </span>
                          {status === "canceled" && subscriber.cancelled_at ? (
                            <span className="flex items-center gap-1 text-error">
                              Cancelled on {formatDate(subscriber.cancelled_at)}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              Expires {formatDate(subscriber.ends_at)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="hidden sm:flex flex-col items-end gap-1">
                        {status === "canceled" ? (
                          <p className="text-sm text-text-tertiary">Cancelled</p>
                        ) : (
                          <p className="text-sm text-text-tertiary">
                            {status === "will_cancel" ? "Expires" : "Renews"}{" "}
                            {formatDate(subscriber.ends_at)}
                          </p>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-xl active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
                            aria-label="Subscriber options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-surface-base border-border-base"
                        >
                          <DropdownMenuItem asChild>
                            <Link href={`/creator/${subscriber.fan_id}`}>View Profile</Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* Sidebar: Studio nav (PC) */}
        <aside className="w-full lg:w-72 shrink-0">
          <div className="sticky top-24 space-y-4">
            <div className="card-block p-4">
              <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                Studio
              </h2>
              <nav className="space-y-1" aria-label="Studio navigation">
                {[
                  { href: "/creator/new-post", icon: Plus, label: "Create Post" },
                  { href: "/creator/studio/earnings", icon: DollarSign, label: "Earnings" },
                  { href: "/creator/studio/subscribers", icon: Users, label: "Subscribers" },
                  { href: "/creator/studio/post/list", icon: FileText, label: "Post List" },
                  { href: "/creator/studio/analytics", icon: BarChart3, label: "Analytics" },
                ].map(({ href, icon: Icon, label }) => {
                  const isActive = href === "/creator/studio/subscribers";
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
