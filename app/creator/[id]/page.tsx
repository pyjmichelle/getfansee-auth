"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// 所有服务器端函数都通过 API 调用，不直接导入
import { type Post } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { MediaDisplay } from "@/components/media-display";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

import {
  Image as ImageIcon,
  Heart,
  FileText,
  AlertTriangle,
  Lock,
  Share2,
  Check,
  Copy,
} from "lucide-react";
import { ReportButton } from "@/components/report-button";
import { toast } from "sonner";

const supabase = getSupabaseBrowserClient();

export default function CreatorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const creatorId = (params?.id as string) || "";

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatorProfile, setCreatorProfile] = useState<{
    id: string;
    display_name?: string;
    bio?: string;
    avatar_url?: string;
  } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [postViewStates, setPostViewStates] = useState<Map<string, boolean>>(new Map());
  const [activeTab, setActiveTab] = useState<"posts" | "media" | "likes">("posts");

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 检查认证
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/auth");
          return;
        }

        // 确保 profile 存在（通过 API）
        await fetch("/api/auth/ensure-profile", { method: "POST" });
        setCurrentUserId(session.user.id);

        // 加载当前用户信息（用于 NavHeader）- 通过 API
        const profileResponse = await fetch("/api/profile");
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          const userProfile = profileData.profile;
          if (userProfile) {
            setCurrentUser({
              username: userProfile.display_name || "user",
              role: (userProfile.role || "fan") as "fan" | "creator",
              avatar: userProfile.avatar_url || undefined,
            });
          }
        }

        // 检查是否已订阅（如果不是 creator 本人）
        if (session.user.id !== creatorId) {
          const statusResponse = await fetch(`/api/subscription/status?creatorId=${creatorId}`);
          const statusData = await statusResponse.json();
          const subscribed = statusData.isSubscribed || false;
          setIsSubscribed(subscribed);
        }

        // 加载 creator profile (from creators table) - 通过 API
        const creatorResponse = await fetch(`/api/creator/${creatorId}`);
        if (!creatorResponse.ok) {
          setError("Creator not found");
          return;
        }
        const creatorData = await creatorResponse.json();
        const creator = creatorData.creator;
        if (!creator) {
          setError("Creator not found");
          return;
        }

        setCreatorProfile({
          id: creator.id,
          display_name: creator.display_name,
          bio: creator.bio,
          avatar_url: creator.avatar_url,
        });

        // 加载 creator posts（通过 API）
        const postsResponse = await fetch(`/api/creator/${creatorId}/posts`);
        if (postsResponse.ok) {
          const postsData = await postsResponse.json();
          setPosts(postsData.posts || []);

          // 使用 API 返回的解锁状态
          const states = new Map<string, boolean>();
          for (const post of postsData.posts || []) {
            states.set(post.id, postsData.unlockedStates?.[post.id] || false);
          }
          setPostViewStates(states);
        }
      } catch (err) {
        console.error("[creator] loadData error", err);
        setError("Failed to load, please try again");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [creatorId, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {currentUser && <NavHeader user={currentUser!} notificationCount={0} />}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Shimmer 骨架屏 */}
          <div className="animate-pulse space-y-8">
            {/* Header Skeleton */}
            <div className="h-48 md:h-64 bg-muted rounded-xl"></div>
            <div className="flex items-center gap-4 -mt-16 px-4">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-muted border-4 border-background"></div>
              <div className="flex-1 space-y-3">
                <div className="h-6 w-48 bg-muted rounded"></div>
                <div className="h-4 w-64 bg-muted rounded"></div>
              </div>
            </div>
            {/* Tabs Skeleton */}
            <div className="flex gap-8 border-b border-border px-4">
              <div className="h-10 w-20 bg-muted rounded"></div>
              <div className="h-10 w-20 bg-muted rounded"></div>
              <div className="h-10 w-20 bg-muted rounded"></div>
            </div>
            {/* Posts Skeleton */}
            <div className="px-4 space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-4 pb-8 border-b border-border">
                  <div className="h-48 bg-muted rounded-xl"></div>
                  <div className="h-4 w-3/4 bg-muted rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !creatorProfile) {
    return (
      <div className="min-h-screen bg-background">
        {currentUser && <NavHeader user={currentUser!} notificationCount={0} />}
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-6">
              <p className="text-destructive font-semibold mb-2">Error</p>
              <p className="text-sm text-muted-foreground mb-4">{error || "Creator not found"}</p>
              <Button asChild variant="outline" className="rounded-lg">
                <Link href="/home">Return to Home</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const handleSubscribe = async () => {
    try {
      setIsSubscribing(true);
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId }),
      });
      const data = await response.json();
      const success = data.success;
      if (success) {
        setIsSubscribed(true);
        // 重新加载 posts（通过 API）
        const postsResponse = await fetch(`/api/creator/${creatorId}/posts`);
        if (postsResponse.ok) {
          const postsData = await postsResponse.json();
          setPosts(postsData.posts || []);

          // 使用 API 返回的解锁状态
          const states = new Map<string, boolean>();
          for (const post of postsData.posts || []) {
            states.set(post.id, postsData.unlockedStates?.[post.id] || false);
          }
          setPostViewStates(states);
        }
      }
    } catch (err) {
      console.error("[creator] subscribe30d error", err);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setIsSubscribing(true);
      const response = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId }),
      });
      const data = await response.json();
      const success = data.success;
      if (success) {
        setIsSubscribed(false);
        // 重新加载 posts（通过 API）
        const postsResponse = await fetch(`/api/creator/${creatorId}/posts`);
        if (postsResponse.ok) {
          const postsData = await postsResponse.json();
          setPosts(postsData.posts || []);

          // 使用 API 返回的解锁状态
          const states = new Map<string, boolean>();
          for (const post of postsData.posts || []) {
            states.set(post.id, postsData.unlockedStates?.[post.id] || false);
          }
          setPostViewStates(states);
        }
      }
    } catch (err) {
      console.error("[creator] cancelSubscription error", err);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/creator/${creatorId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard!");
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast.success("Link copied to clipboard!");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {currentUser && <NavHeader user={currentUser!} notificationCount={0} />}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 封面图 Banner */}
        <div className="relative w-full h-48 md:h-64 rounded-xl overflow-hidden mt-6 mb-6">
          <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5"></div>
        </div>

        {/* 头像和个人信息 */}
        <div className="relative -mt-20 mb-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="flex items-end gap-4 md:gap-6">
              <Avatar className="w-24 h-24 md:w-32 md:h-32 border-4 border-background ring-2 ring-border shadow-xl">
                <AvatarImage
                  src={creatorProfile.avatar_url || "/placeholder.svg"}
                  alt={creatorProfile.display_name || "Creator"}
                />
                <AvatarFallback className="text-2xl md:text-3xl bg-primary/10 text-primary">
                  {creatorProfile.display_name?.[0]?.toUpperCase() || "C"}
                </AvatarFallback>
              </Avatar>
              <div className="pb-2">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                  {creatorProfile.display_name || "Creator"}
                </h1>
                {creatorProfile.bio && (
                  <p className="text-muted-foreground text-sm md:text-base max-w-md line-clamp-2">
                    {creatorProfile.bio}
                  </p>
                )}
              </div>
            </div>

            {/* 订阅按钮 - 桌面端 */}
            {currentUserId && currentUserId !== creatorId && (
              <div className="hidden md:flex flex-col gap-3">
                {isSubscribed ? (
                  <Button
                    variant="outline"
                    onClick={handleCancelSubscription}
                    disabled={isSubscribing}
                    className="rounded-lg min-w-[160px] min-h-[44px]"
                  >
                    {isSubscribing ? "Processing..." : "Unsubscribe"}
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubscribe}
                    disabled={isSubscribing}
                    className="rounded-lg min-w-[160px] min-h-[44px]"
                  >
                    {isSubscribing ? "Processing..." : "Subscribe"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleShare}
                  className="rounded-lg min-w-[160px] min-h-[44px]"
                  data-testid="share-button"
                >
                  <Share2 className="w-4 h-4 mr-2" aria-hidden="true" />
                  Share
                </Button>
                <ReportButton
                  targetType="user"
                  targetId={creatorId}
                  variant="outline"
                  className="rounded-lg min-w-[160px] min-h-[44px]"
                />
              </div>
            )}
          </div>
        </div>

        {/* Tabs: Posts, Media, Likes */}
        <div className="mb-8">
          <div className="flex gap-6 md:gap-8 border-b border-border relative">
            <button
              onClick={() => setActiveTab("posts")}
              className={cn(
                "pb-3 text-sm md:text-base font-medium transition-colors relative min-h-[44px] flex items-center",
                activeTab === "posts"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" aria-hidden="true" />
                <span>Posts</span>
              </div>
              {activeTab === "posts" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("media")}
              className={cn(
                "pb-3 text-sm md:text-base font-medium transition-colors relative min-h-[44px] flex items-center",
                activeTab === "media"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" aria-hidden="true" />
                <span>Media</span>
              </div>
              {activeTab === "media" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("likes")}
              className={cn(
                "pb-3 text-sm md:text-base font-medium transition-colors relative min-h-[44px] flex items-center",
                activeTab === "likes"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4" aria-hidden="true" />
                <span>Likes</span>
              </div>
              {activeTab === "likes" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"></span>
              )}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="pb-24 md:pb-12">
          {activeTab === "posts" && (
            <div className="space-y-6">
              {posts.length === 0 ? (
                <Card className="rounded-xl border shadow-sm">
                  <CardContent className="py-16 text-center">
                    <FileText
                      className="w-16 h-16 mx-auto mb-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <h3 className="text-lg font-semibold mb-2">No Posts Yet</h3>
                    <p className="text-muted-foreground text-sm">
                      This creator hasn't posted anything yet.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                posts.map((post) => {
                  const canView =
                    postViewStates.get(post.id) === true || post.creator_id === currentUserId;

                  return (
                    <Card
                      key={post.id}
                      className="rounded-xl border shadow-sm hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-6">
                        {post.title && (
                          <Link href={`/posts/${post.id}`}>
                            <h3 className="text-xl font-bold text-foreground mb-3 hover:text-primary transition-colors cursor-pointer line-clamp-2">
                              {post.title}
                            </h3>
                          </Link>
                        )}
                        {canView ? (
                          <p className="text-foreground whitespace-pre-wrap mb-6 line-clamp-4 text-sm leading-relaxed">
                            {post.content}
                          </p>
                        ) : (
                          <div className="bg-muted/50 border border-border rounded-xl p-6 text-center mb-6">
                            <Lock
                              className="w-10 h-10 mx-auto mb-3 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <p className="text-muted-foreground mb-4 text-sm">
                              {post.price_cents === 0
                                ? "This content is for subscribers only"
                                : `Unlock for $${((post.price_cents || 0) / 100).toFixed(2)}`}
                            </p>
                            {post.price_cents === 0 ? (
                              <Button
                                size="sm"
                                onClick={handleSubscribe}
                                disabled={isSubscribing}
                                className="rounded-lg min-h-[40px]"
                              >
                                {isSubscribing ? "Processing..." : "Subscribe to view"}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const response = await fetch("/api/unlock", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        postId: post.id,
                                        priceCents: post.price_cents || 0,
                                      }),
                                    });
                                    const result = await response.json();
                                    if (result.success && currentUserId) {
                                      // 重新加载 posts（通过 API）
                                      const postsResponse = await fetch(
                                        `/api/creator/${creatorId}/posts`
                                      );
                                      if (postsResponse.ok) {
                                        const postsData = await postsResponse.json();
                                        setPosts(postsData.posts || []);

                                        // 使用 API 返回的解锁状态，并标记当前解锁的 post
                                        const states = new Map<string, boolean>();
                                        for (const p of postsData.posts || []) {
                                          if (p.creator_id === currentUserId) {
                                            states.set(p.id, true);
                                          } else {
                                            // 已解锁的 post 设为可见
                                            states.set(
                                              p.id,
                                              p.id === post.id
                                                ? true
                                                : postsData.unlockedStates?.[p.id] || false
                                            );
                                          }
                                        }
                                        setPostViewStates(states);
                                      }
                                    }
                                  } catch (err) {
                                    console.error("[creator] unlock error", err);
                                  }
                                }}
                                className="rounded-lg min-h-[40px]"
                              >
                                Unlock for ${((post.price_cents || 0) / 100).toFixed(2)}
                              </Button>
                            )}
                          </div>
                        )}

                        {/* Media Display */}
                        {((post.media && post.media.length > 0) || post.media_url) && (
                          <div className="mb-4">
                            <MediaDisplay
                              post={post}
                              canView={canView}
                              isCreator={post.creator_id === currentUserId}
                              onSubscribe={handleSubscribe}
                              onUnlock={async () => {
                                try {
                                  const response = await fetch("/api/unlock", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      postId: post.id,
                                      priceCents: post.price_cents || 0,
                                    }),
                                  });
                                  const result = await response.json();
                                  if (result.success && currentUserId) {
                                    // 重新加载 posts（通过 API）
                                    const postsResponse = await fetch(
                                      `/api/creator/${creatorId}/posts`
                                    );
                                    if (postsResponse.ok) {
                                      const postsData = await postsResponse.json();
                                      setPosts(postsData.posts || []);

                                      // 使用 API 返回的解锁状态，并标记当前解锁的 post
                                      const states = new Map<string, boolean>();
                                      for (const p of postsData.posts || []) {
                                        if (p.creator_id === currentUserId) {
                                          states.set(p.id, true);
                                        } else {
                                          // 已解锁的 post 设为可见
                                          states.set(
                                            p.id,
                                            p.id === post.id
                                              ? true
                                              : postsData.unlockedStates?.[p.id] || false
                                          );
                                        }
                                      }
                                      setPostViewStates(states);
                                    }
                                  }
                                } catch (err) {
                                  console.error("[creator] unlock error", err);
                                }
                              }}
                              creatorDisplayName={creatorProfile.display_name}
                            />
                          </div>
                        )}

                        <div className="pt-4 border-t flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {formatDate(post.created_at)}
                          </span>
                          <Button variant="ghost" size="sm" asChild className="rounded-lg">
                            <Link href={`/posts/${post.id}`}>View Details</Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "media" && (
            <Card className="rounded-xl border shadow-sm">
              <CardContent className="py-16 text-center">
                <ImageIcon
                  className="w-16 h-16 mx-auto mb-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <h3 className="text-lg font-semibold mb-2">Media Gallery</h3>
                <p className="text-muted-foreground text-sm">Coming soon...</p>
              </CardContent>
            </Card>
          )}

          {activeTab === "likes" && (
            <Card className="rounded-xl border shadow-sm">
              <CardContent className="py-16 text-center">
                <Heart
                  className="w-16 h-16 mx-auto mb-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <h3 className="text-lg font-semibold mb-2">Liked Posts</h3>
                <p className="text-muted-foreground text-sm">Coming soon...</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 移动端: 底部浮动订阅按钮 */}
        {currentUserId && currentUserId !== creatorId && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border z-50 shadow-lg">
            {isSubscribed ? (
              <Button
                variant="outline"
                onClick={handleCancelSubscription}
                disabled={isSubscribing}
                className="w-full rounded-lg h-12 min-h-[48px]"
              >
                {isSubscribing ? "Processing..." : "Unsubscribe"}
              </Button>
            ) : (
              <Button
                onClick={handleSubscribe}
                disabled={isSubscribing}
                className="w-full rounded-lg h-12 min-h-[48px]"
              >
                {isSubscribing ? "Processing..." : "Subscribe"}
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  // 使用 date-fns 统一格式化时间
  return formatDistanceToNow(date, { addSuffix: true });
}
