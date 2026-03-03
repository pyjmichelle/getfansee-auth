"use client";

import { useState, useEffect } from "react";
import { Calendar, Heart } from "@/lib/icons";
import { PageShell } from "@/components/page-shell";
import { CreatorAvatarLink } from "@/components/creator-avatar-link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getAuthBootstrap } from "@/lib/auth-bootstrap-client";
// cancelSubscription 通过 API 调用，不直接导入
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useCountUp } from "@/hooks/use-count-up";

const supabase = getSupabaseBrowserClient();

type Subscription = {
  id: string;
  creator_id: string;
  plan: string;
  status: string;
  current_period_end: string;
  created_at: string;
  cancelled_at?: string | null;
  price_cents?: number;
  creator?: {
    id: string;
    display_name: string;
    avatar_url?: string | null;
    subscription_price_cents?: number;
  };
};

export default function SubscriptionsPage() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingSubscriptionId, setCancellingSubscriptionId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id?: string;
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === "true";

  const MOCK_SUBSCRIPTIONS: Subscription[] = [
    {
      id: "mock-sub-1",
      creator_id: "mock-creator-1",
      plan: "monthly",
      status: "active",
      current_period_end: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      cancelled_at: null,
      creator: {
        id: "mock-creator-1",
        display_name: "Elena Rose",
        avatar_url: "/creator-avatar.png",
      },
    },
    {
      id: "mock-sub-2",
      creator_id: "mock-creator-2",
      plan: "monthly",
      status: "active",
      current_period_end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString(),
      cancelled_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      creator: {
        id: "mock-creator-2",
        display_name: "Maya Styles",
        avatar_url: "/artist-creator-avatar.jpg",
      },
    },
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        if (isTestMode) {
          setCurrentUser({
            username: "test-user",
            role: "fan",
          });
          setSubscriptions(MOCK_SUBSCRIPTIONS);
          setIsLoading(false);
          return;
        }

        const bootstrap = await getAuthBootstrap();
        if (!bootstrap.authenticated || !bootstrap.user) {
          if (isTestMode) {
            setCurrentUser({
              username: "test-user",
              role: "fan",
            });
            setSubscriptions(MOCK_SUBSCRIPTIONS);
            setIsLoading(false);
            return;
          }
          router.push("/auth");
          return;
        }

        if (bootstrap.profile) {
          setCurrentUser({
            id: bootstrap.user.id,
            username: bootstrap.profile.display_name || "user",
            role: (bootstrap.profile.role || "fan") as "fan" | "creator",
            avatar: bootstrap.profile.avatar_url || undefined,
          });
        } else if (isTestMode) {
          setCurrentUser({
            username: bootstrap.user.email?.split("@")[0] || "test-user",
            role: "fan",
          });
        }

        // Load subscriptions for current user
        const { data: subsData, error } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("subscriber_id", bootstrap.user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("[subscriptions] load error:", error);
          return;
        }

        // Load creator info for each subscription
        const normalizedSubscriptions = (subsData || []) as Subscription[];
        const subsWithCreators = await Promise.all(
          normalizedSubscriptions.map(async (sub) => {
            let creator: {
              id: string;
              display_name: string;
              avatar_url?: string | null;
            } | null = null;

            try {
              const response = await fetch(`/api/creator/${sub.creator_id}`);
              if (response.ok) {
                const payload = await response.json();
                creator = payload?.creator ?? null;
              }
            } catch (creatorError) {
              console.error("[subscriptions] load creator error:", creatorError);
            }

            return {
              ...sub,
              creator: creator || undefined,
            };
          })
        );

        if (isTestMode && subsWithCreators.length === 0) {
          setSubscriptions(MOCK_SUBSCRIPTIONS);
        } else {
          setSubscriptions(subsWithCreators);
        }
      } catch (err) {
        console.error("[subscriptions] loadData error:", err);
        if (isTestMode) {
          setCurrentUser({ username: "test-user", role: "fan" });
          setSubscriptions(MOCK_SUBSCRIPTIONS);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router]);

  const handleCancel = async (subscriptionId: string, creatorId: string) => {
    try {
      const response = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId }),
      });
      const data = await response.json();
      const success = data.success;
      if (success) {
        // 重新加载订阅列表以获取 cancelled_at（复用已有的 currentUser 状态避免重复取 session）
        const userId = currentUser?.id;
        if (!userId) return;
        const { data: subsData } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("subscriber_id", userId)
          .order("created_at", { ascending: false });

        if (subsData) {
          const subsWithCreators = await Promise.all(
            (subsData as Subscription[]).map(async (sub) => {
              let creator: {
                id: string;
                display_name: string;
                avatar_url?: string | null;
              } | null = null;

              try {
                const response = await fetch(`/api/creator/${sub.creator_id}`);
                if (response.ok) {
                  const payload = await response.json();
                  creator = payload?.creator ?? null;
                }
              } catch (creatorError) {
                console.error("[subscriptions] load creator error:", creatorError);
              }

              return {
                ...sub,
                creator: creator || undefined,
              };
            })
          );
          setSubscriptions(subsWithCreators);
        }
      }
    } catch (err) {
      console.error("[subscriptions] cancel error:", err);
    } finally {
      setCancellingSubscriptionId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getRenewsIn = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return "Expired";
    if (days === 0) return "Renews today";
    if (days === 1) return "Renews tomorrow";
    return `Renews in ${days} days`;
  };

  const activeCount = subscriptions.filter((s) => s.status === "active").length;
  const expiringCount = subscriptions.filter((s) => {
    if (s.status !== "active") return false;
    const diff = new Date(s.current_period_end).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days <= 7 && days >= 0;
  }).length;
  const monthlyCost = subscriptions
    .filter((s) => s.status === "active")
    .reduce((sum, s) => {
      const priceCents = s.price_cents ?? s.creator?.subscription_price_cents ?? 0;
      return sum + priceCents / 100;
    }, 0);
  const animatedSupportCount = useCountUp(subscriptions.length, { duration: 900, decimals: 0 });
  const animatedMonthlyCost = useCountUp(monthlyCost, { duration: 900, decimals: 2 });

  if (isLoading || !currentUser) {
    return (
      <PageShell user={currentUser} notificationCount={0} maxWidth="5xl">
        <div className="space-y-4 pt-6">
          <div className="card-block bg-gradient-subtle p-6 md:p-8 animate-pulse">
            <div className="h-10 w-72 bg-white/8 rounded mb-3" />
            <div className="h-4 w-48 bg-white/8 rounded mb-6" />
            <div className="h-10 w-40 bg-white/8 rounded-xl" />
          </div>
          <div className="bento-grid animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-block h-24 bg-white/5" />
            ))}
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-block h-32 bg-white/5 animate-pulse" />
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell user={currentUser} notificationCount={0} maxWidth="5xl">
      {/* Hero Banner */}
      <div className="card-block bg-gradient-subtle p-6 md:p-8 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">
          Supporting{" "}
          <span className="text-gradient-primary">{animatedSupportCount.toFixed(0)}</span> creators
        </h1>
        <p className="text-text-secondary text-sm md:text-base mb-4">
          Manage and optimize your creator subscriptions.
        </p>
        <Link href="/home">
          <Button
            variant="subscribe-gradient"
            className="text-white shadow-glow hover-bold active:scale-[0.97]"
          >
            Discover More Creators
          </Button>
        </Link>
      </div>

      {/* PC: Two-column | Mobile: Single-column */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Column: Subscriptions list */}
        <div className="flex-1 min-w-0">
          {subscriptions.length === 0 ? (
            <div className="bg-surface-raised border border-border-base rounded-2xl p-8 text-center">
              <EmptyState
                data-testid="subscriptions-list"
                icon={<Heart className="size-6 text-violet-400" />}
                title="No subscriptions found"
                description="Subscribe to your favorite creators to unlock their exclusive content"
                action={{ label: "Discover Creators", href: "/home" }}
              />
            </div>
          ) : (
            <div
              className="bg-surface-raised border border-border-base rounded-2xl divide-y divide-border-base"
              data-testid="subscriptions-list"
            >
              {subscriptions.map((subscription, index) => (
                <div
                  key={subscription.id}
                  className="p-4 md:p-6 hover:bg-surface-overlay/50 transition-colors animate-profile-reveal"
                  data-testid="subscription-item"
                  data-subscription-id={subscription.id}
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 md:gap-4 flex-1">
                      <CreatorAvatarLink
                        id={subscription.creator_id}
                        name={subscription.creator?.display_name}
                        avatarUrl={subscription.creator?.avatar_url}
                        size="md"
                        subtitle={
                          subscription.status === "active"
                            ? getRenewsIn(subscription.current_period_end)
                            : "Expired"
                        }
                      />
                      <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-text-tertiary mt-1 ml-0">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{subscription.plan}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Badge
                        variant={subscription.status === "active" ? "default" : "secondary"}
                        className={
                          subscription.status === "active"
                            ? "bg-success/10 text-success border-success/20"
                            : ""
                        }
                      >
                        {subscription.status === "active" ? "Active" : "Canceled"}
                      </Badge>
                      {subscription.status === "active" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-text-tertiary hover:text-error hover:bg-error/10 active:scale-95 focus-visible:ring-2 focus-visible:ring-error"
                          onClick={() => setCancellingSubscriptionId(subscription.id)}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>

                  {subscription.status === "active" && (
                    <div className="mt-3 pt-3 border-t border-border-subtle">
                      <p className="text-xs text-text-quaternary">
                        Subscribed since {formatDate(subscription.created_at)} • Renews on{" "}
                        {formatDate(subscription.current_period_end)}
                      </p>
                    </div>
                  )}

                  {subscription.status === "canceled" && subscription.cancelled_at && (
                    <div className="mt-3 pt-3 border-t border-border-subtle">
                      <p className="text-xs text-text-quaternary">
                        Cancelled on {formatDate(subscription.cancelled_at)}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Cancel Confirmation Dialog */}
        </div>

        {/* Sidebar: Stats (PC only, below list on mobile) */}
        <aside className="w-full lg:w-72 lg:shrink-0">
          <div className="sticky top-24 space-y-4">
            <div className="card-block p-5">
              <h2 className="text-sm font-semibold text-text-primary mb-4">Stats</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-tertiary">Active</span>
                  <span className="font-bold text-success">{activeCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-tertiary">Expiring Soon</span>
                  <span className="font-bold text-warning">{expiringCount}</span>
                </div>
                <div className="h-px bg-border-base" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-tertiary">Monthly Cost</span>
                  <span className="font-bold text-gradient-primary">
                    ${animatedMonthlyCost.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {cancellingSubscriptionId && (
        <AlertDialog
          open={cancellingSubscriptionId !== null}
          onOpenChange={(open) => !open && setCancellingSubscriptionId(null)}
        >
          <AlertDialogContent className="bg-surface-base border-border-base rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-text-primary">
                Cancel Your Subscription
              </AlertDialogTitle>
              <AlertDialogDescription className="text-text-tertiary">
                {(() => {
                  const sub = subscriptions.find((s) => s.id === cancellingSubscriptionId);
                  if (!sub) return "Are you sure you want to cancel this subscription?";
                  return `Are you sure you want to cancel your subscription to ${sub.creator?.display_name || "this creator"}? Your subscription will end on ${format(new Date(sub.current_period_end), "MMM d, yyyy")}.`;
                })()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border-base bg-surface-raised hover:bg-surface-overlay rounded-xl">
                Keep Subscription
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const sub = subscriptions.find((s) => s.id === cancellingSubscriptionId);
                  if (sub) {
                    handleCancel(sub.id, sub.creator_id);
                  }
                }}
                className="bg-error hover:bg-error/90 rounded-xl"
              >
                Cancel Subscription
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </PageShell>
  );
}
