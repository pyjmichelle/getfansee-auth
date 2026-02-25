"use client";

import { useState, useEffect } from "react";
import { DollarSign, Calendar } from "lucide-react";
import { NavHeader } from "@/components/nav-header";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import Link from "next/link";
import { useRouter } from "next/navigation";

const supabase = getSupabaseBrowserClient();

type Purchase = {
  id: string;
  post_id: string;
  paid_amount_cents: number;
  created_at: string;
  post?: {
    id: string;
    title?: string;
    content: string;
    creator_id: string;
    creator?: {
      id: string;
      display_name: string;
      avatar_url?: string | null;
    };
  };
};

export default function PurchasesPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === "true";

  useEffect(() => {
    const loadData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          if (isTestMode) {
            setCurrentUser({
              username: "test-user",
              role: "fan",
            });
            setIsLoading(false);
            setPurchases([]);
            return;
          }
          router.push("/auth");
          return;
        }

        await ensureProfile();
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

        // Load purchases
        const { data: purchasesData, error } = await supabase
          .from("purchases")
          .select("*")
          .eq("fan_id", session.user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("[purchases] load error:", error);
          return;
        }

        // Load post and creator info for each purchase
        const normalizedPurchases = (purchasesData || []) as Purchase[];
        const purchasesWithPosts = await Promise.all(
          normalizedPurchases.map(async (purchase) => {
            const { data: postData, error: postError } = await supabase
              .from("posts")
              .select("id, title, content, creator_id")
              .eq("id", purchase.post_id)
              .single();

            if (postError || !postData) {
              return {
                ...purchase,
                post: undefined,
              };
            }

            let creator: {
              id: string;
              display_name: string;
              avatar_url?: string | null;
            } | null = null;

            try {
              const response = await fetch(`/api/creator/${postData.creator_id}`);
              if (response.ok) {
                const payload = await response.json();
                creator = payload?.creator ?? null;
              }
            } catch (creatorError) {
              console.error("[purchases] load creator error:", creatorError);
            }

            return {
              ...purchase,
              post: {
                ...postData,
                creator: creator || undefined,
              },
            };
          })
        );

        setPurchases(purchasesWithPosts);
      } catch (err) {
        console.error("[purchases] loadData error:", err);
        if (isTestMode) {
          setCurrentUser({
            username: "test-user",
            role: "fan",
          });
          setPurchases([]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const totalSpent = purchases.reduce((sum, purchase) => sum + purchase.paid_amount_cents, 0);

  if (isLoading || !currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingState type="spinner" text="Loading purchases..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <NavHeader user={currentUser} notificationCount={0} />

      <main className="pt-20 md:pt-24 max-w-4xl mx-auto px-4 md:px-6 py-8">
        {/* Stats Card - Figma Style */}
        <div className="bg-gradient-subtle border border-border-base rounded-2xl p-6 md:p-8 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">Your Purchases</h1>
          <p className="text-text-tertiary text-sm md:text-base mb-6">
            View all your unlocked content
          </p>

          {purchases.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-base/50 rounded-xl p-4">
                <p className="text-xs text-text-tertiary mb-1">Total Purchases</p>
                <p className="text-2xl font-bold text-text-primary">{purchases.length}</p>
              </div>
              <div className="bg-surface-base/50 rounded-xl p-4">
                <p className="text-xs text-text-tertiary mb-1">Total Spent</p>
                <p className="text-2xl font-bold text-brand-accent">
                  ${(totalSpent / 100).toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Purchases List */}
        {purchases.length === 0 ? (
          <div className="bg-surface-raised border border-border-base rounded-2xl p-8">
            <EmptyState
              data-testid="purchases-list"
              icon="shopping-bag"
              title="No purchases yet"
              description="Unlock premium content from your favorite creators"
              action={{ label: "Browse Content", href: "/home" }}
            />
          </div>
        ) : (
          <div
            className="bg-surface-raised border border-border-base rounded-2xl divide-y divide-border-base"
            data-testid="purchases-list"
          >
            {purchases.map((purchase) => (
              <div
                key={purchase.id}
                className="p-4 md:p-6 hover:bg-surface-overlay/50 transition-colors"
                data-testid="purchase-item"
                data-purchase-id={purchase.id}
              >
                <div className="flex items-start gap-3 mb-3">
                  <Link
                    href={`/creator/${purchase.post?.creator_id}`}
                    className="flex items-center gap-3 flex-1"
                  >
                    <Avatar className="w-10 h-10 ring-2 ring-transparent hover:ring-brand-primary/30 transition-all">
                      <AvatarImage src={purchase.post?.creator?.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback className="bg-brand-primary-alpha-10 text-brand-primary font-semibold">
                        {purchase.post?.creator?.display_name?.[0]?.toUpperCase() || "C"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <span className="font-semibold text-text-primary block truncate">
                        {purchase.post?.creator?.display_name || "Creator"}
                      </span>
                      <p className="text-xs text-text-tertiary">Creator</p>
                    </div>
                  </Link>
                  <div className="text-right">
                    <p className="text-lg font-bold text-brand-accent">
                      ${(purchase.paid_amount_cents / 100).toFixed(2)}
                    </p>
                    <p className="text-xs text-text-quaternary">
                      {formatDate(purchase.created_at)}
                    </p>
                  </div>
                </div>

                {purchase.post?.title && (
                  <h3 className="font-semibold text-text-primary mb-1 line-clamp-1">
                    {purchase.post.title}
                  </h3>
                )}
                <p className="text-text-secondary text-sm mb-4 line-clamp-2">
                  {purchase.post?.content}
                </p>

                <Button asChild variant="outline" size="sm" className="rounded-xl">
                  <Link href={`/posts/${purchase.post_id}`}>View Content</Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
