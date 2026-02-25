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

import { Image as ImageIcon, Heart, FileText, Lock, Share2, ChevronLeft } from "lucide-react";
import { ReportButton } from "@/components/report-button";
import { toast } from "sonner";
import { BottomNavigation } from "@/components/bottom-navigation";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";

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
      <div className="min-h-screen bg-background pb-16 md:pb-0">
        {currentUser && <NavHeader user={currentUser!} notificationCount={0} />}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <LoadingState type="skeleton" />
        </main>
        <BottomNavigation notificationCount={0} userRole={currentUser?.role} />
      </div>
    );
  }

  if (error || !creatorProfile) {
    return (
      <div className="min-h-screen bg-background pb-16 md:pb-0">
        {currentUser && <NavHeader user={currentUser!} notificationCount={0} />}
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorState
            title="Creator Not Found"
            message={error || "This creator does not exist"}
            retry={() => router.push("/home")}
            variant="centered"
          />
        </main>
        <BottomNavigation notificationCount={0} userRole={currentUser?.role} />
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
    } catch {
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
    <div className="min-h-screen bg-background pb-20">
      {/* Fixed Header - Figma Style */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border-base">
        <div className="flex items-center justify-between px-4 h-14">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.back()}
            aria-label="Go back"
            className="text-text-primary"
          >
            <ChevronLeft className="w-6 h-6" aria-hidden="true" />
          </Button>
          <h1 className="font-semibold text-text-primary truncate max-w-[200px]">
            {creatorProfile.display_name || "Creator"}
          </h1>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleShare}
            aria-label="Share profile"
            className="text-text-primary"
          >
            <Share2 className="w-5 h-5" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {/* Banner - Figma Style */}
      <div className="relative mt-14 h-56 sm:h-80">
        <div className="w-full h-full bg-gradient-primary opacity-80"></div>
      </div>

      {/* Avatar Section - Figma Style */}
      <div className="relative -mt-16 sm:-mt-20 mb-6 px-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex items-end gap-4">
            <Avatar className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-background ring-2 ring-brand-primary/30 shadow-glow">
              <AvatarImage
                src={creatorProfile.avatar_url || "/placeholder.svg"}
                alt={creatorProfile.display_name || "Creator"}
              />
              <AvatarFallback className="text-2xl sm:text-3xl bg-brand-primary-alpha-10 text-brand-primary font-bold">
                {creatorProfile.display_name?.[0]?.toUpperCase() || "C"}
              </AvatarFallback>
            </Avatar>
            <div className="pb-2">
              <h1 className="text-xl sm:text-2xl font-bold text-text-primary mb-1">
                {creatorProfile.display_name || "Creator"}
              </h1>
              {creatorProfile.bio && (
                <p className="text-text-tertiary text-sm max-w-md line-clamp-2">
                  {creatorProfile.bio}
                </p>
              )}
            </div>
          </div>

          {/* Subscribe Button - Desktop */}
          {currentUserId && currentUserId !== creatorId && (
            <div className="hidden sm:flex flex-col gap-2">
              {isSubscribed ? (
                <Button
                  variant="outline"
                  onClick={handleCancelSubscription}
                  disabled={isSubscribing}
                  className="rounded-xl min-w-[140px]"
                >
                  {isSubscribing ? "..." : "Subscribed"}
                </Button>
              ) : (
                <Button
                  variant="subscribe-gradient"
                  onClick={handleSubscribe}
                  disabled={isSubscribing}
                  className="rounded-xl min-w-[140px]"
                >
                  {isSubscribing ? "..." : "Subscribe"}
                </Button>
              )}
              <ReportButton
                targetType="user"
                targetId={creatorId}
                variant="ghost"
                size="sm"
                className="text-text-tertiary"
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-2xl mx-auto">
        {/* Tabs - Figma Style */}
        <div className="px-4 mb-4">
          <div className="flex border-b border-border-base">
            <button
              onClick={() => setActiveTab("posts")}
              className={cn(
                "flex-1 pb-3 text-sm font-medium transition-colors relative",
                activeTab === "posts"
                  ? "text-brand-primary"
                  : "text-text-tertiary hover:text-text-primary"
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" aria-hidden="true" />
                <span>Posts</span>
              </div>
              {activeTab === "posts" && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-brand-primary rounded-full"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("media")}
              className={cn(
                "flex-1 pb-3 text-sm font-medium transition-colors relative",
                activeTab === "media"
                  ? "text-brand-primary"
                  : "text-text-tertiary hover:text-text-primary"
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <ImageIcon className="w-4 h-4" aria-hidden="true" />
                <span>Media</span>
              </div>
              {activeTab === "media" && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-brand-primary rounded-full"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("likes")}
              className={cn(
                "flex-1 pb-3 text-sm font-medium transition-colors relative",
                activeTab === "likes"
                  ? "text-brand-primary"
                  : "text-text-tertiary hover:text-text-primary"
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <Heart className="w-4 h-4" aria-hidden="true" />
                <span>Likes</span>
              </div>
              {activeTab === "likes" && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-brand-primary rounded-full"></span>
              )}
            </button>
          </div>
        </div>

        {/* Tab Content - Grid Layout for Media */}
        <div className="px-4 pb-24">
          {activeTab === "posts" && (
            <div className="space-y-4">
              {posts.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-text-quaternary" />
                  <p className="text-text-tertiary">No posts yet</p>
                </div>
              ) : (
                posts.map((post) => {
                  const canView =
                    postViewStates.get(post.id) === true || post.creator_id === currentUserId;

                  return (
                    <div
                      key={post.id}
                      className="bg-surface-base border border-border-base rounded-2xl overflow-hidden"
                    >
                      <div className="p-4">
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
                                ? "This exclusive content is for subscribers only"
                                : `Unlock this hot content for $${((post.price_cents || 0) / 100).toFixed(2)}`}
                            </p>
                            {post.price_cents === 0 ? (
                              <Button
                                size="sm"
                                variant="subscribe-gradient"
                                onClick={handleSubscribe}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleSubscribe();
                                  }
                                }}
                                disabled={isSubscribing}
                                className="rounded-xl min-h-[44px] font-semibold shadow-lg"
                                aria-label={
                                  isSubscribing
                                    ? "Processing subscription…"
                                    : "Subscribe to unlock this content"
                                }
                              >
                                {isSubscribing ? "Processing…" : "Subscribe to Unlock"}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="unlock-gradient"
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
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    // Trigger unlock
                                  }
                                }}
                                className="rounded-xl min-h-[44px] font-semibold shadow-lg"
                                aria-label={`Unlock this content for $${((post.price_cents || 0) / 100).toFixed(2)}`}
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

                        <div className="pt-4 border-t border-border-base flex items-center justify-between">
                          <span className="text-sm text-text-tertiary">
                            {post.created_at ? formatDate(post.created_at) : "Unknown date"}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="rounded-lg text-brand-primary"
                          >
                            <Link href={`/posts/${post.id}`}>View Details</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
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
                <p className="text-muted-foreground text-sm">Liked posts feature is coming soon</p>
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
                {isSubscribing ? "Processing…" : "Unsubscribe"}
              </Button>
            ) : (
              <Button
                onClick={handleSubscribe}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSubscribe();
                  }
                }}
                disabled={isSubscribing}
                variant="subscribe-gradient"
                className="w-full rounded-xl h-12 min-h-[48px] font-bold shadow-lg"
                aria-label={
                  isSubscribing ? "Processing subscription…" : "Subscribe to this creator"
                }
              >
                {isSubscribing ? "Processing…" : "Subscribe Now"}
              </Button>
            )}
          </div>
        )}
      </main>

      <BottomNavigation notificationCount={0} />
    </div>
  );
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  // 使用 date-fns 统一格式化时间
  return formatDistanceToNow(date, { addSuffix: true });
}
