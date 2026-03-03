"use client";

import { useState, useEffect } from "react";
import { PageShell } from "@/components/page-shell";
import { CreatorAvatarLink } from "@/components/creator-avatar-link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCountUp } from "@/hooks/use-count-up";
import { Coins } from "@/lib/icons";
import { getAuthBootstrap } from "@/lib/auth-bootstrap-client";
import { useSkeletonMetric } from "@/hooks/use-skeleton-metric";

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
  useSkeletonMetric("purchases_page", isLoading);

  useEffect(() => {
    const loadData = async () => {
      try {
        const bootstrap = await getAuthBootstrap();
        if (!bootstrap.authenticated || !bootstrap.user) {
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

        setCurrentUser({
          username: bootstrap.profile?.display_name || bootstrap.user.email.split("@")[0] || "user",
          role: (bootstrap.profile?.role || "fan") as "fan" | "creator",
          avatar: bootstrap.profile?.avatar_url || undefined,
        });

        const purchasesResponse = await fetch("/api/purchases", { cache: "no-store" });
        if (!purchasesResponse.ok) {
          if (isTestMode) {
            setPurchases([
              {
                id: "mock-purchase-1",
                post_id: "mock-post-1",
                paid_amount_cents: 1500,
                created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                post: {
                  id: "mock-post-1",
                  title: "Behind the Scenes — Exclusive Photoshoot",
                  content: "Exclusive behind-the-scenes content from the latest studio session.",
                  creator_id: "mock-creator-1",
                  creator: {
                    id: "mock-creator-1",
                    display_name: "Elena Rose",
                    avatar_url: "/creator-avatar.png",
                  },
                },
              },
              {
                id: "mock-purchase-2",
                post_id: "mock-post-2",
                paid_amount_cents: 999,
                created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                post: {
                  id: "mock-post-2",
                  title: "Summer Collection Preview",
                  content: "Exclusive preview of the upcoming summer collection.",
                  creator_id: "mock-creator-2",
                  creator: {
                    id: "mock-creator-2",
                    display_name: "Maya Styles",
                    avatar_url: "/artist-creator-avatar.jpg",
                  },
                },
              },
            ]);
          } else {
            console.error("[purchases] failed to load purchases:", purchasesResponse.status);
          }
          return;
        }
        const purchasesPayload = (await purchasesResponse.json()) as { data?: Purchase[] };
        const loadedPurchases = purchasesPayload.data || [];
        setPurchases(
          isTestMode && loadedPurchases.length === 0
            ? [
                {
                  id: "mock-purchase-1",
                  post_id: "mock-post-1",
                  paid_amount_cents: 1500,
                  created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                  post: {
                    id: "mock-post-1",
                    title: "Behind the Scenes — Exclusive Photoshoot",
                    content: "Exclusive behind-the-scenes content from the latest studio session.",
                    creator_id: "mock-creator-1",
                    creator: {
                      id: "mock-creator-1",
                      display_name: "Elena Rose",
                      avatar_url: "/creator-avatar.png",
                    },
                  },
                },
                {
                  id: "mock-purchase-2",
                  post_id: "mock-post-2",
                  paid_amount_cents: 999,
                  created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                  post: {
                    id: "mock-post-2",
                    title: "Summer Collection Preview",
                    content: "Exclusive preview of the upcoming summer collection.",
                    creator_id: "mock-creator-2",
                    creator: {
                      id: "mock-creator-2",
                      display_name: "Maya Styles",
                      avatar_url: "/artist-creator-avatar.jpg",
                    },
                  },
                },
              ]
            : loadedPurchases
        );
      } catch (err) {
        console.error("[purchases] loadData error:", err);
        if (isTestMode) {
          setCurrentUser({ username: "test-user", role: "fan" });
          setPurchases([
            {
              id: "mock-purchase-1",
              post_id: "mock-post-1",
              paid_amount_cents: 1500,
              created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              post: {
                id: "mock-post-1",
                title: "Behind the Scenes — Exclusive Photoshoot",
                content: "Exclusive behind-the-scenes content from the latest studio session.",
                creator_id: "mock-creator-1",
                creator: {
                  id: "mock-creator-1",
                  display_name: "Elena Rose",
                  avatar_url: "/creator-avatar.png",
                },
              },
            },
            {
              id: "mock-purchase-2",
              post_id: "mock-post-2",
              paid_amount_cents: 999,
              created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              post: {
                id: "mock-post-2",
                title: "Summer Collection Preview",
                content: "Exclusive preview of the upcoming summer collection.",
                creator_id: "mock-creator-2",
                creator: {
                  id: "mock-creator-2",
                  display_name: "Maya Styles",
                  avatar_url: "/artist-creator-avatar.jpg",
                },
              },
            },
          ]);
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
  const totalSpentUsd = totalSpent / 100;
  const animatedPurchaseCount = useCountUp(purchases.length, { duration: 900, decimals: 0 });
  const animatedSpent = useCountUp(totalSpentUsd, { duration: 900, decimals: 2 });

  if (isLoading || !currentUser) {
    return (
      <PageShell user={currentUser} notificationCount={0} maxWidth="4xl">
        <div className="py-8 space-y-4">
          <div className="bento-grid animate-pulse">
            <div className="bento-2x1 rounded-2xl h-40 bg-white/5" />
            <div className="rounded-2xl h-24 bg-white/5" />
            <div className="rounded-2xl h-24 bg-white/5" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl h-28 bg-white/5 animate-pulse" />
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell user={currentUser} notificationCount={0} maxWidth="5xl">
      <div className="py-8">
        {/* Hero Banner */}
        <div className="card-block bg-gradient-subtle p-6 md:p-8 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">Your Purchases</h1>
          <p className="text-text-tertiary text-sm md:text-base">
            You&apos;ve unlocked{" "}
            <span className="font-bold text-brand-primary">{animatedPurchaseCount.toFixed(0)}</span>{" "}
            exclusive pieces of content.
          </p>
        </div>

        {/* PC: Two-column | Mobile: Single-column */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Column */}
          <div className="flex-1 min-w-0">
            {purchases.length === 0 ? (
              <div className="card-block p-8">
                <EmptyState
                  data-testid="purchases-list"
                  icon={<Coins className="size-6 text-white/40" />}
                  title="No purchases yet"
                  description="Unlock premium content from your favorite creators"
                  action={{ label: "Browse Content", href: "/home" }}
                />
              </div>
            ) : (
              <div className="space-y-4" data-testid="purchases-list">
                {purchases.map((purchase, index) => (
                  <div
                    key={purchase.id}
                    className="card-block p-4 md:p-6 animate-profile-reveal"
                    data-testid="purchase-item"
                    data-purchase-id={purchase.id}
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        <CreatorAvatarLink
                          id={purchase.post?.creator_id || ""}
                          name={purchase.post?.creator?.display_name}
                          avatarUrl={purchase.post?.creator?.avatar_url}
                          size="sm"
                          subtitle="Creator"
                        />
                      </div>
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
          </div>

          {/* Sidebar Stats (PC only) */}
          <aside className="w-full lg:w-64 lg:shrink-0">
            <div className="sticky top-24 space-y-4">
              <div className="card-block p-5">
                <h2 className="text-sm font-semibold text-text-primary mb-4">Summary</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-tertiary">Total Purchases</span>
                    <span className="font-bold text-text-primary">
                      {animatedPurchaseCount.toFixed(0)}
                    </span>
                  </div>
                  <div className="h-px bg-border-base" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-tertiary">Total Spent</span>
                    <span className="font-bold text-gradient-primary">
                      ${animatedSpent.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
