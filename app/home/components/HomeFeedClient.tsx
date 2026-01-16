"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { type Post } from "@/lib/types";
import { MediaDisplay } from "@/components/media-display";
import { useUnlock } from "@/contexts/unlock-context";
import { PostLikeButton } from "@/components/post-like-button";
import Link from "next/link";
import { Lock, Heart, Share2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PaywallModal } from "@/components/paywall-modal";
import { cn } from "@/lib/utils";

interface HomeFeedClientProps {
  initialPosts: Post[];
  initialUnlockedStates: Map<string, boolean>;
  currentUserId: string | null;
  userProfile: {
    role: string;
    display_name?: string;
    avatar_url?: string;
  } | null;
}

export function HomeFeedClient({
  initialPosts,
  initialUnlockedStates,
  currentUserId,
  userProfile,
}: HomeFeedClientProps) {
  const router = useRouter();
  const { addUnlockedPost, isUnlocked: isUnlockedGlobal } = useUnlock();
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [error, setError] = useState<string | null>(null);
  const [postViewStates, setPostViewStates] = useState<Map<string, boolean>>(initialUnlockedStates);
  const [subscribingCreators, setSubscribingCreators] = useState<Set<string>>(new Set());
  const [paywallPost, setPaywallPost] = useState<Post | null>(null);

  const currentUser = {
    username: userProfile?.display_name || "user",
    role: (userProfile?.role || "fan") as "fan" | "creator",
    avatar: userProfile?.avatar_url || "/fan-user-avatar.jpg",
  };

  // 重新加载 feed（在订阅/解锁后调用）
  const reloadFeed = async () => {
    try {
      setError(null);
      const response = await fetch("/api/feed");
      if (!response.ok) {
        throw new Error("Failed to fetch feed");
      }
      const data = await response.json();
      const feedPosts: Post[] = data.posts || [];
      setPosts(feedPosts);

      // 更新可见性状态（基于 API 返回的状态和全局解锁状态）
      const states = new Map<string, boolean>();
      for (const post of feedPosts) {
        if (post.creator_id === currentUserId) {
          states.set(post.id, true);
        } else if (post.visibility === "free") {
          states.set(post.id, true);
        } else if (isUnlockedGlobal(post.id)) {
          states.set(post.id, true);
        } else {
          // 使用 API 返回的解锁状态
          states.set(post.id, data.unlockedStates?.[post.id] || false);
        }
      }
      setPostViewStates(states);
    } catch (err) {
      console.error("[home] reloadFeed error", err);
      setError("加载失败");
    }
  };

  const handleSubscribe = async (creatorId: string) => {
    try {
      setSubscribingCreators((prev) => new Set(prev).add(creatorId));
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId }),
      });
      const data = await response.json();
      if (data.success) {
        // 重新加载 feed 和可见性状态
        await reloadFeed();
      } else {
        setError(data.error || "订阅失败");
      }
    } catch (err) {
      console.error("[home] subscribe error", err);
      setError("订阅失败，请重试");
    } finally {
      setSubscribingCreators((prev) => {
        const next = new Set(prev);
        next.delete(creatorId);
        return next;
      });
    }
  };

  const handleShowPaywall = (post: Post) => {
    setError(null);
    setPaywallPost(post);
  };

  const handleUnlockSuccess = async (post: Post) => {
    addUnlockedPost(post.id);
    setPostViewStates((prev) => {
      const next = new Map(prev);
      next.set(post.id, true);
      return next;
    });
    await reloadFeed();
    setPaywallPost(null);
  };

  return (
    <div className="min-h-screen bg-[#050505]">
      <NavHeader user={currentUser} notificationCount={0} />

      <main className="container max-w-[680px] mx-auto px-4 md:px-8 py-8 md:py-12">
        {/* Mobile: Tab 切换 (关注/发现) */}
        <div className="lg:hidden mb-8">
          <div className="flex gap-8 border-b border-[#1F1F1F] relative">
            <button className="pb-4 text-base font-medium text-foreground relative">
              Following
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-gradient"></span>
            </button>
            <button className="pb-4 text-base font-medium text-muted-foreground">Discover</button>
          </div>
        </div>

        {/* Desktop: 标题 */}
        <div className="hidden lg:block mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Feed</h1>
          <p className="text-muted-foreground">Discover content from creators</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg">{error}</div>
        )}

        {posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No posts found</p>
            <p className="text-sm text-muted-foreground">
              Visit{" "}
              <Link href="/me" className="text-primary underline">
                /me
              </Link>{" "}
              to create your creator profile and start posting
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => {
              // 免费内容永远可见
              const isFree = post.visibility === "free";
              // 优先检查全局解锁状态，然后检查本地状态
              const canView = isFree
                ? true
                : isUnlockedGlobal(post.id) || (postViewStates.get(post.id) ?? false);
              const isCreator = post.creator_id === currentUserId;
              const isSubscribing = subscribingCreators.has(post.creator_id);
              const isUnlocking = paywallPost?.id === post.id;

              return (
                <article
                  key={post.id}
                  className="pb-8 mb-8 border-b border-[#1F1F1F] last:border-b-0"
                >
                  {/* Creator Header */}
                  <div className="flex items-center gap-3 mb-6">
                    <Link href={`/creator/${post.creator_id}`}>
                      <Avatar className="w-10 h-10 cursor-pointer hover:opacity-80 transition-opacity">
                        <AvatarImage
                          src={post.creator?.avatar_url || "/placeholder.svg"}
                          alt={post.creator?.display_name || "Creator"}
                          onError={(e) => {
                            // 如果图片加载失败，使用 fallback
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                          }}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {post.creator?.display_name?.[0]?.toUpperCase() || "C"}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1">
                      <Link href={`/creator/${post.creator_id}`}>
                        <h3 className="font-semibold text-foreground hover:text-primary transition-colors">
                          {post.creator?.display_name || "Creator"}
                        </h3>
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {/* Post Content */}
                  {post.title && (
                    <h2 className="text-xl font-semibold text-foreground mb-3">{post.title}</h2>
                  )}
                  <p className="text-foreground mb-6 whitespace-pre-wrap">{post.content}</p>

                  {/* Media Display */}
                  <div className="mb-6">
                    <MediaDisplay
                      post={post}
                      canView={canView || isCreator}
                      isCreator={isCreator}
                      onSubscribe={() => handleSubscribe(post.creator_id)}
                      onUnlock={() => handleShowPaywall(post)}
                      creatorDisplayName={post.creator?.display_name}
                    />
                  </div>

                  {/* Locked State Actions */}
                  {!canView && !isCreator && (
                    <div className="mt-6 p-6 bg-[#0D0D0D] rounded-3xl border border-[#1F1F1F]">
                      {post.visibility === "subscribers" ? (
                        <div className="text-center">
                          <Lock className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground mb-4">
                            This content is for subscribers only
                          </p>
                          <Button
                            onClick={() => handleSubscribe(post.creator_id)}
                            disabled={isSubscribing}
                            variant="gradient"
                            size="sm"
                            className="rounded-xl"
                          >
                            {isSubscribing ? "处理中..." : "Subscribe to view"}
                          </Button>
                        </div>
                      ) : post.visibility === "ppv" ? (
                        <div className="text-center">
                          <Lock className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground mb-4">
                            Unlock this post for ${((post.price_cents || 0) / 100).toFixed(2)}
                          </p>
                          <Button
                            onClick={() => handleShowPaywall(post)}
                            disabled={isUnlocking}
                            variant="gradient"
                            size="sm"
                            className="rounded-xl"
                          >
                            {isUnlocking
                              ? "处理中..."
                              : `Unlock for $${((post.price_cents || 0) / 100).toFixed(2)}`}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Post Actions */}
                  <div className="flex items-center gap-6 pt-6">
                    <PostLikeButton
                      postId={post.id}
                      initialLikesCount={post.likes_count || 0}
                      userId={currentUserId || undefined}
                    />
                    {/* Comment 功能已全局隐藏 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 hover:bg-white/5 rounded-xl min-h-[44px] min-w-[44px]"
                    >
                      <Share2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Share</span>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
      <PaywallModal
        open={!!paywallPost}
        onOpenChange={(open) => {
          if (!open) {
            setPaywallPost(null);
          }
        }}
        type="ppv"
        creatorName={paywallPost?.creator?.display_name || "Creator"}
        creatorAvatar={paywallPost?.creator?.avatar_url}
        price={(paywallPost?.price_cents || 0) / 100}
        benefits={["Unlock this exclusive content", "Reward the creator"]}
        postId={paywallPost?.id}
        creatorId={paywallPost?.creator_id}
        onSuccess={async () => {
          if (paywallPost) {
            await handleUnlockSuccess(paywallPost);
          }
        }}
      />
    </div>
  );
}
