"use client";

import { useState, useEffect } from "react";
import { Calendar } from "lucide-react";
import { NavHeader } from "@/components/nav-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
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
  cancelled_at?: string | null; // 针对已取消的订阅，显示其对应的 cancelled_at 日期
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

  useEffect(() => {
    const loadData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
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
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={0} />

      <main className="container max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Your Subscriptions</h1>
          <p className="text-muted-foreground">Manage your creator subscriptions</p>
        </div>

        {subscriptions.length === 0 ? (
          <EmptyState
            icon="heart"
            title="No subscriptions found"
            description="Start following your favorite creators to see them here"
            action={{ label: "Discover Creators", href: "/home" }}
          />
        ) : (
          <div className="space-y-4">
            {subscriptions.map((subscription) => (
              <div
                key={subscription.id}
                className="bg-card border border-border rounded-3xl p-6 hover:border-[#262626] transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <Link
                    href={`/creator/${subscription.creator_id}`}
                    className="flex items-center gap-4 flex-1"
                  >
                    <Avatar className="w-16 h-16">
                      <AvatarImage src={subscription.creator?.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback>
                        {subscription.creator?.display_name?.[0]?.toUpperCase() || "C"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg text-foreground">
                          {subscription.creator?.display_name || "Creator"}
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {subscription.status === "active"
                            ? getRenewsIn(subscription.current_period_end)
                            : "Expired"}
                        </div>
                        <div className="flex items-center gap-1">
                          <span>Plan: {subscription.plan}</span>
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div className="flex flex-col items-end gap-3">
                    <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                      {subscription.status === "active" ? "Active" : "Canceled"}
                    </Badge>
                    {subscription.status === "active" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-border bg-card hover:bg-[#1A1A1A] rounded-xl"
                        onClick={() => setCancellingSubscriptionId(subscription.id)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>

                {subscription.status === "active" && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Subscribed since {formatDate(subscription.created_at)} • Will end on{" "}
                      {formatDate(subscription.current_period_end)}
                    </p>
                  </div>
                )}

                {/* 针对已取消的订阅，显示其对应的 cancelled_at 日期 */}
                {subscription.status === "canceled" && subscription.cancelled_at && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
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
            <AlertDialogContent className="bg-card border-border rounded-3xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-foreground">Cancel Subscription</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  {(() => {
                    const sub = subscriptions.find((s) => s.id === cancellingSubscriptionId);
                    if (!sub) return "Are you sure you want to cancel this subscription?";
                    return `Are you sure you want to cancel your subscription to ${sub.creator?.display_name || "this creator"}? Your subscription will end on ${format(new Date(sub.current_period_end), "MMM d, yyyy")}.`;
                  })()}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-border bg-card hover:bg-[#1A1A1A] rounded-xl">
                  Keep Subscription
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const sub = subscriptions.find((s) => s.id === cancellingSubscriptionId);
                    if (sub) {
                      handleCancel(sub.id, sub.creator_id);
                    }
                  }}
                  className="bg-destructive hover:bg-destructive/90 rounded-xl"
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
