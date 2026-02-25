"use client";

import { useState, useEffect } from "react";
import { Calendar } from "lucide-react";
import { NavHeader } from "@/components/nav-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getProfile } from "@/lib/profile";
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

const supabase = getSupabaseBrowserClient();

type Subscription = {
  id: string;
  creator_id: string;
  plan: string;
  status: string;
  current_period_end: string;
  created_at: string;
  cancelled_at?: string | null; // For canceled subscriptions, display the corresponding cancelled_at date
  creator?: {
    id: string;
    display_name: string;
    avatar_url?: string | null;
  };
};

export default function SubscriptionsPage() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingSubscriptionId, setCancellingSubscriptionId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === "true";

  useEffect(() => {
    const loadData = async () => {
      try {
        if (isTestMode) {
          setCurrentUser({
            username: "test-user",
            role: "fan",
          });
          setSubscriptions([]);
          setIsLoading(false);
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          if (isTestMode) {
            setCurrentUser({
              username: "test-user",
              role: "fan",
            });
            setSubscriptions([]);
            setIsLoading(false);
            return;
          }
          router.push("/auth");
          return;
        }

        await fetch("/api/auth/ensure-profile", { method: "POST" });
        const profile = await getProfile(session.user.id);
        if (profile) {
          setCurrentUser({
            username: profile.display_name || "user",
            role: (profile.role || "fan") as "fan" | "creator",
            avatar: profile.avatar_url || undefined,
          });
        } else if (isTestMode) {
          setCurrentUser({
            username: session.user.email?.split("@")[0] || "test-user",
            role: "fan",
          });
        }

        // Load subscriptions（强制使用 getSession() 获取当前用户）
        const { data: subsData, error } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("subscriber_id", session.user.id)
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

        setSubscriptions(subsWithCreators);
      } catch (err) {
        console.error("[subscriptions] loadData error:", err);
        if (isTestMode) {
          setCurrentUser({
            username: "test-user",
            role: "fan",
          });
          setSubscriptions([]);
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
        // 重新加载订阅列表以获取 cancelled_at
        const { data: subsData } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("subscriber_id", (await supabase.auth.getSession()).data.session?.user.id)
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

  if (isLoading || !currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingState type="spinner" text="Loading subscriptions..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <NavHeader user={currentUser} notificationCount={0} />

      <main className="pt-20 md:pt-24 px-4 md:px-6 max-w-5xl mx-auto">
        {/* Hero Section - Figma Style */}
        <div className="bg-gradient-primary p-6 rounded-2xl shadow-glow mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">My Subscriptions</h1>
          <p className="text-white/80 text-sm md:text-base">
            Manage your subscriptions to exclusive creators
          </p>
        </div>

        {subscriptions.length === 0 ? (
          <div className="bg-surface-raised border border-border-base rounded-2xl p-8 text-center">
            <EmptyState
              data-testid="subscriptions-list"
              icon="heart"
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
            {subscriptions.map((subscription) => (
              <div
                key={subscription.id}
                className="p-4 md:p-6 hover:bg-surface-overlay/50 transition-colors"
                data-testid="subscription-item"
                data-subscription-id={subscription.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <Link
                    href={`/creator/${subscription.creator_id}`}
                    className="flex items-center gap-3 md:gap-4 flex-1"
                  >
                    <Avatar className="w-12 h-12 md:w-14 md:h-14 ring-2 ring-transparent hover:ring-brand-primary/30 transition-all">
                      <AvatarImage src={subscription.creator?.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback className="bg-brand-primary-alpha-10 text-brand-primary font-semibold">
                        {subscription.creator?.display_name?.[0]?.toUpperCase() || "C"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base md:text-lg text-text-primary truncate">
                        {subscription.creator?.display_name || "Creator"}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-text-tertiary mt-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {subscription.status === "active"
                              ? getRenewsIn(subscription.current_period_end)
                              : "Expired"}
                          </span>
                        </div>
                        <span className="text-text-quaternary">•</span>
                        <span>{subscription.plan}</span>
                      </div>
                    </div>
                  </Link>

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
                        className="text-text-tertiary hover:text-error hover:bg-error/10"
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
      </main>
    </div>
  );
}
