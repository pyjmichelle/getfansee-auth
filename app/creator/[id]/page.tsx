"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// 所有服务器端函数都通过 API 调用，不直接导入
import { type Post } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { MediaDisplay } from "@/components/media-display";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

const supabase = getSupabaseBrowserClient();
import { Image as ImageIcon, Heart, FileText, AlertTriangle } from "lucide-react";

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
        setError("加载失败，请重试");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [creatorId, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {currentUser && <NavHeader user={currentUser} notificationCount={0} />}
        <main className="container max-w-4xl mx-auto px-4 py-6">
          {/* Shimmer 骨架屏 */}
          <div className="animate-pulse space-y-8">
            {/* Header Skeleton */}
            <div className="h-64 bg-muted rounded-3xl"></div>
            <div className="flex items-center gap-4 -mt-16 px-8">
              <div className="w-32 h-32 rounded-full bg-muted border-4 border-background"></div>
              <div className="flex-1 space-y-3">
                <div className="h-6 w-48 bg-muted rounded"></div>
                <div className="h-4 w-64 bg-muted rounded"></div>
              </div>
            </div>
            {/* Tabs Skeleton */}
            <div className="flex gap-8 border-b border-border">
              <div className="h-10 w-20 bg-muted rounded"></div>
              <div className="h-10 w-20 bg-muted rounded"></div>
              <div className="h-10 w-20 bg-muted rounded"></div>
            </div>
            {/* Posts Skeleton */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-4 pb-8 border-b border-border">
                <div className="h-48 bg-muted rounded-3xl"></div>
                <div className="h-4 w-3/4 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error || !creatorProfile) {
    return (
      <div className="min-h-screen bg-background">
        {currentUser && <NavHeader user={currentUser} notificationCount={0} />}
        <main className="container max-w-2xl mx-auto px-4 py-6">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-destructive font-medium">错误</p>
            <p className="text-sm text-muted-foreground mt-1">{error || "Creator not found"}</p>
            <Link href="/home">
              <button className="mt-4 text-sm text-primary hover:underline">返回首页</button>
            </Link>
          </div>
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

  return (
    <div className="min-h-screen bg-background relative">
      {currentUser && <NavHeader user={currentUser} notificationCount={0} />}

      <main className="container max-w-4xl mx-auto px-4 md:px-8 py-0">
        {/* 封面图全屏宽度 */}
        <div className="relative w-full h-64 md:h-80 -mx-4 md:-mx-8 mb-0 overflow-hidden">
          <div className="w-full h-full bg-gradient-to-br from-[#6366F1]/20 via-[#A855F7]/20 to-[#EC4899]/20"></div>
          {/* 如果有封面图，可以在这里显示 */}
        </div>

        {/* 头像半重叠布局，带渐变发光环 */}
        <div className="relative px-4 md:px-8 -mt-16 md:-mt-20 mb-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="flex items-end gap-6">
              <div className="relative">
                <div className="absolute -inset-1 bg-primary-gradient rounded-full blur-md opacity-50"></div>
                <Avatar className="relative w-24 h-24 md:w-32 md:h-32 border-4 border-background">
                  <AvatarImage src={creatorProfile.avatar_url || "/placeholder.svg"} />
                  <AvatarFallback className="text-3xl md:text-4xl bg-card text-foreground">
                    {creatorProfile.display_name?.[0]?.toUpperCase() || "C"}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="pb-2">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                  {creatorProfile.display_name || "Creator"}
                </h1>
                {creatorProfile.bio && (
                  <p className="text-muted-foreground max-w-md">{creatorProfile.bio}</p>
                )}
              </div>
            </div>

            {/* PC: 订阅按钮固定在右侧 */}
            {currentUserId && currentUserId !== creatorId && (
              <div className="hidden md:flex flex-col gap-3">
                {isSubscribed ? (
                  <Button
                    variant="outline"
                    onClick={handleCancelSubscription}
                    disabled={isSubscribing}
                    className="rounded-xl border-border bg-card hover:bg-card min-w-[160px]"
                  >
                    {isSubscribing ? "处理中..." : "Cancel Subscription"}
                  </Button>
                ) : (
                  <Button
                    variant="gradient"
                    onClick={handleSubscribe}
                    disabled={isSubscribing}
                    className="rounded-xl min-w-[160px]"
                  >
                    {isSubscribing ? "处理中..." : "Subscribe"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  asChild
                  className="rounded-xl border-border bg-card hover:bg-card min-w-[160px] text-muted-foreground"
                >
                  <Link href={`/report?type=user&id=${creatorId}`}>
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Report
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs: Posts, Media, Likes */}
        <div className="px-4 md:px-8 mb-8">
          <div className="flex gap-8 border-b border-border relative">
            <button
              onClick={() => setActiveTab("posts")}
              className={`pb-4 text-base font-medium transition-colors relative ${
                activeTab === "posts" ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Posts</span>
              </div>
              {activeTab === "posts" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-gradient"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("media")}
              className={`pb-4 text-base font-medium transition-colors relative ${
                activeTab === "media" ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                <span>Media</span>
              </div>
              {activeTab === "media" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-gradient"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("likes")}
              className={`pb-4 text-base font-medium transition-colors relative ${
                activeTab === "likes" ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4" />
                <span>Likes</span>
              </div>
              {activeTab === "likes" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-gradient"></span>
              )}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-4 md:px-8 pb-24 md:pb-8">
          {activeTab === "posts" && (
            <div className="space-y-8">
              {posts.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No posts yet.</p>
                </div>
              ) : (
                posts.map((post) => {
                  const canView =
                    postViewStates.get(post.id) === true || post.creator_id === currentUserId;

                  return (
                    <article key={post.id} className="pb-8 border-b border-border last:border-b-0">
                      {post.title && (
                        <Link href={`/posts/${post.id}`}>
                          <h3 className="text-xl font-semibold text-foreground mb-3 hover:text-primary transition-colors cursor-pointer">
                            {post.title}
                          </h3>
                        </Link>
                      )}
                      {canView ? (
                        <p className="text-foreground whitespace-pre-wrap mb-6">{post.content}</p>
                      ) : (
                        <div className="bg-card border border-border rounded-3xl p-6 text-center mb-6">
                          <p className="text-muted-foreground mb-4">
                            {post.price_cents === 0
                              ? "This content is for subscribers only"
                              : `Unlock for $${((post.price_cents || 0) / 100).toFixed(2)}`}
                          </p>
                          {post.price_cents === 0 ? (
                            <Button
                              size="sm"
                              variant="gradient"
                              onClick={handleSubscribe}
                              disabled={isSubscribing}
                              className="rounded-xl"
                            >
                              {isSubscribing ? "处理中..." : "Subscribe to view"}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="gradient"
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
                              className="rounded-xl"
                            >
                              Unlock for ${((post.price_cents || 0) / 100).toFixed(2)}
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Media Display */}
                      {((post.media && post.media.length > 0) || post.media_url) && (
                        <div className="mb-6">
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

                      <span className="text-sm text-muted-foreground">
                        {formatDate(post.created_at)}
                      </span>
                    </article>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "media" && (
            <div className="text-center py-16 text-muted-foreground">
              <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Media tab coming soon</p>
            </div>
          )}

          {activeTab === "likes" && (
            <div className="text-center py-16 text-muted-foreground">
              <Heart className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Likes tab coming soon</p>
            </div>
          )}
        </div>

        {/* MB: 底部浮动订阅按钮 */}
        {currentUserId && currentUserId !== creatorId && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border z-50">
            {isSubscribed ? (
              <Button
                variant="outline"
                onClick={handleCancelSubscription}
                disabled={isSubscribing}
                className="w-full rounded-xl border-border bg-card hover:bg-card h-12"
              >
                {isSubscribing ? "处理中..." : "Cancel Subscription"}
              </Button>
            ) : (
              <Button
                variant="gradient"
                onClick={handleSubscribe}
                disabled={isSubscribing}
                className="w-full rounded-xl h-12"
              >
                {isSubscribing ? "处理中..." : "Subscribe"}
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
