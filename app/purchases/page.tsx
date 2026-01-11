"use client";

import { useState, useEffect } from "react";
import { DollarSign, Calendar } from "lucide-react";
import { NavHeader } from "@/components/nav-header";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
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

        await ensureProfile();
        const profile = await getProfile(session.user.id);
        if (profile) {
          setCurrentUser({
            username: profile.display_name || "user",
            role: (profile.role || "fan") as "fan" | "creator",
            avatar: profile.avatar_url || undefined,
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
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={0} />

      <main className="container max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Your Purchases</h1>
          <p className="text-muted-foreground">View all your unlocked content</p>
        </div>

        {/* Stats */}
        {purchases.length > 0 && (
          <Card className="p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Purchases</p>
                <p className="text-2xl font-bold text-foreground">{purchases.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Spent</p>
                <p className="text-2xl font-bold text-foreground">
                  ${(totalSpent / 100).toFixed(2)}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Purchases List */}
        {purchases.length === 0 ? (
          <EmptyState
            icon="shopping-bag"
            title="No purchases yet"
            description="Unlock premium content from your favorite creators"
            action={{ label: "Browse Content", href: "/home" }}
          />
        ) : (
          <div className="space-y-4">
            {purchases.map((purchase) => (
              <Card key={purchase.id} className="overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <Link
                      href={`/creator/${purchase.post?.creator_id}`}
                      className="flex items-center gap-3"
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarImage
                          src={purchase.post?.creator?.avatar_url || "/placeholder.svg"}
                        />
                        <AvatarFallback>
                          {purchase.post?.creator?.display_name?.[0]?.toUpperCase() || "C"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {purchase.post?.creator?.display_name || "Creator"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">Creator</p>
                      </div>
                    </Link>
                  </div>

                  {purchase.post?.title && (
                    <h3 className="font-semibold text-foreground mb-2">{purchase.post.title}</h3>
                  )}
                  <p className="text-foreground mb-4 line-clamp-2">{purchase.post?.content}</p>

                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />$
                      {(purchase.paid_amount_cents / 100).toFixed(2)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Purchased {formatDate(purchase.created_at)}
                    </div>
                  </div>

                  <Button asChild variant="outline" className="bg-transparent">
                    <Link href={`/creator/${purchase.post?.creator_id}`}>View Content</Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
