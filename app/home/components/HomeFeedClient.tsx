"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { type Post } from "@/lib/types";
import { MediaDisplay } from "@/components/media-display";
import { useUnlock } from "@/contexts/unlock-context";
import { PostLikeButton } from "@/components/post-like-button";
import Link from "next/link";
import { Lock, Share2, AlertCircle, TrendingUp, Users, Hash } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PaywallModal } from "@/components/paywall-modal";
import { toast } from "sonner";
import { CenteredContainer } from "@/components/layouts/centered-container";
import { LoadingState } from "@/components/loading-state";
import { BottomNavigation } from "@/components/bottom-navigation";

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
  const [isLoading, setIsLoading] = useState(false);

  const currentUser = {
    id: currentUserId,
    username: userProfile?.display_name || "user",
    role: (userProfile?.role || "fan") as "fan" | "creator",
    avatar: userProfile?.avatar_url || "/fan-user-avatar.jpg",
  };

  const reloadFeed = async () => {
    try {
      setError(null);
      setIsLoading(true);
      const response = await fetch("/api/feed");
      if (!response.ok) {
        throw new Error("Failed to fetch feed");
      }
      const data = await response.json();
      const feedPosts: Post[] = data.posts || [];
      setPosts(feedPosts);

      const states = new Map<string, boolean>();
      for (const post of feedPosts) {
        if (post.creator_id === currentUserId) {
          states.set(post.id, true);
        } else if (post.visibility === "free") {
          states.set(post.id, true);
        } else if (isUnlockedGlobal(post.id)) {
          states.set(post.id, true);
        } else {
          states.set(post.id, data.unlockedStates?.[post.id] || false);
        }
      }
      setPostViewStates(states);
    } catch (err) {
      console.error("[home] reloadFeed error", err);
      setError("Unable to load feed. Please try again.");
    } finally {
      setIsLoading(false);
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
        await reloadFeed();
        toast.success("Subscribed successfully");
      } else {
        setError(data.error || "Subscription failed");
        toast.error(data.error || "Subscription failed");
      }
    } catch (err) {
      console.error("[home] subscribe error", err);
      setError("Subscription failed");
      toast.error("Unable to subscribe. Please try again.");
    } finally {
      setSubscribingCreators((prev) => {
        const next = new Set(prev);
        next.delete(creatorId);
        return next;
      });
    }
  };

  const handleUnlock = (post: Post) => {
    setPaywallPost(post);
  };

  const handlePaywallSuccess = (postId: string) => {
    addUnlockedPost(postId);
    setPostViewStates((prev) => new Map(prev).set(postId, true));
    setPaywallPost(null);
    toast.success("Unlocked successfully");
  };

  const handleShare = async (post: Post) => {
    const url = `${window.location.origin}/posts/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Unable to copy link. Please try again.");
    }
  };

  if (isLoading && posts.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <NavHeader user={currentUser!} />
        <CenteredContainer className="py-12">
          <LoadingState type="spinner" text="Loading…" />
        </CenteredContainer>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background pb-20 md:pb-0"
      data-testid="page-ready"
      style={{ touchAction: "manipulation", overscrollBehaviorY: "contain" }}
    >
      <NavHeader user={currentUser!} />

      <CenteredContainer maxWidth="7xl" className="py-5 sm:py-6 lg:py-8">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* 左侧边栏 - 仅桌面显示 */}
          <aside className="hidden lg:block lg:col-span-3 space-y-5 sticky top-20 self-start">
            <Card role="complementary" aria-label="Trending creators">
              <CardHeader className="pb-2">
                <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
                  Trending Creators
                </h2>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Trending creators will appear here</p>
              </CardContent>
            </Card>

            <Card role="complementary" aria-label="Popular tags">
              <CardHeader className="pb-2">
                <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Hash className="h-4 w-4 text-primary" aria-hidden="true" />
                  Popular Tags
                </h2>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Popular tags will appear here</p>
              </CardContent>
            </Card>
          </aside>

          {/* 主内容区 */}
          <main
            className="lg:col-span-6"
            role="main"
            aria-label="Home feed"
            data-testid="home-feed"
          >
            {posts.length === 0 ? (
              <Card data-testid="empty-state">
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">Your Feed Is Empty</h3>
                  <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-5">
                    Discover exclusive creators and unlock premium content. Start following your
                    favorites to see their latest posts here.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                    <Button
                      variant="subscribe-gradient"
                      onClick={() => router.push("/discover")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push("/discover");
                        }
                      }}
                      aria-label="Explore creators and discover new content"
                    >
                      <TrendingUp className="w-4 h-4 mr-1.5" aria-hidden="true" />
                      Discover Creators
                    </Button>
                    {currentUser?.role === "fan" && (
                      <Button
                        variant="outline"
                        onClick={() => router.push("/creator/upgrade")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push("/creator/upgrade");
                          }
                        }}
                        aria-label="Become a creator and start sharing content"
                      >
                        Start Creating
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-5">
                {posts.map((post, index) => {
                  const isUnlocked = postViewStates.get(post.id) || false;
                  const creatorId = post.creator_id;
                  const isSubscribing = creatorId ? subscribingCreators.has(creatorId) : false;

                  return (
                    <Card
                      key={post.id}
                      style={index > 10 ? { contentVisibility: "auto" as const } : undefined}
                      data-testid="post-card"
                      data-post-id={post.id}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-3">
                          <Link
                            href={`/creator/${post.creator_id}`}
                            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity min-w-0 flex-1"
                            aria-label={`View ${post.creator?.display_name || "creator"}'s profile`}
                          >
                            <Avatar className="h-9 w-9 ring-2 ring-border">
                              <AvatarImage
                                src={post.creator?.avatar_url || undefined}
                                alt={post.creator?.display_name || "Creator"}
                              />
                              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                {post.creator?.display_name?.[0]?.toUpperCase() || "C"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate text-foreground">
                                {post.creator?.display_name || "Creator"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {post.created_at
                                  ? formatDistanceToNow(new Date(post.created_at), {
                                      addSuffix: true,
                                    })
                                  : "Unknown date"}
                              </p>
                            </div>
                          </Link>

                          {creatorId && creatorId !== currentUserId && !isUnlocked && (
                            <Button
                              size="sm"
                              variant="subscribe-gradient"
                              onClick={() => creatorId && handleSubscribe(creatorId)}
                              data-testid="creator-subscribe-button"
                              data-creator-id={creatorId}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  if (creatorId) {
                                    handleSubscribe(creatorId);
                                  }
                                }
                              }}
                              disabled={isSubscribing}
                              className="shrink-0"
                              aria-label={
                                isSubscribing
                                  ? `Subscribing to ${post.creator?.display_name || "creator"}…`
                                  : `Subscribe to ${post.creator?.display_name || "creator"}`
                              }
                            >
                              {isSubscribing ? "Subscribing…" : "Subscribe"}
                            </Button>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="pb-3">
                        {post.title && (
                          <Link href={`/posts/${post.id}`} aria-label={`View post: ${post.title}`}>
                            <h3 className="text-base font-semibold mb-1.5 hover:text-primary transition-colors cursor-pointer line-clamp-2 text-foreground">
                              {post.title}
                            </h3>
                          </Link>
                        )}

                        {post.content && (
                          <p className="text-muted-foreground mb-3 line-clamp-2 text-sm">
                            {post.content}
                          </p>
                        )}

                        {isUnlocked ? (
                          <Link
                            href={`/posts/${post.id}`}
                            aria-label={`View media for post: ${post.title || "Untitled"}`}
                          >
                            <div className="rounded-xl overflow-hidden cursor-pointer hover:opacity-95 transition-opacity">
                              <MediaDisplay
                                post={post}
                                canView={true}
                                isCreator={false}
                                creatorDisplayName={post.creator?.display_name}
                              />
                            </div>
                          </Link>
                        ) : (
                          <div
                            className="relative rounded-xl overflow-hidden bg-secondary/50 border border-border"
                            role="region"
                            aria-label="Locked content preview"
                            data-testid="post-locked-preview"
                          >
                            <div className="aspect-video flex flex-col items-center justify-center p-5">
                              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                                <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
                              </div>
                              <p className="text-sm font-medium mb-1 text-foreground">
                                Locked Content
                              </p>
                              <p className="text-xs text-muted-foreground mb-3" aria-live="polite">
                                {post.price_cents
                                  ? `$${(post.price_cents / 100).toFixed(2)}`
                                  : "Subscribe to unlock"}
                              </p>
                              <Button
                                size="sm"
                                onClick={() => handleUnlock(post)}
                                data-testid="post-unlock-trigger"
                                data-post-id={post.id}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleUnlock(post);
                                  }
                                }}
                                aria-label={
                                  post.price_cents
                                    ? `Unlock this post for $${(post.price_cents / 100).toFixed(2)}`
                                    : "Subscribe to unlock this content"
                                }
                              >
                                Unlock Now
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>

                      <CardFooter className="pt-2.5 border-t border-border flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <PostLikeButton
                            postId={post.id}
                            initialLikesCount={post.likes_count || 0}
                            userId={currentUser?.id || undefined}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/posts/${post.id}#comments`)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                router.push(`/posts/${post.id}#comments`);
                              }
                            }}
                            className="gap-1.5"
                            aria-label={`View comments for post: ${post.title || "Untitled"}`}
                          >
                            <span className="text-sm">Comment</span>
                          </Button>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleShare(post)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleShare(post);
                            }
                          }}
                          aria-label="Share post"
                        >
                          <Share2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </main>

          {/* 右侧边栏 - 仅桌面显示 */}
          <aside className="hidden lg:block lg:col-span-3 space-y-5 sticky top-20 self-start">
            <Card role="complementary" aria-label="Suggested follows">
              <CardHeader className="pb-2">
                <h2 className="text-sm font-semibold text-foreground">Suggested Follows</h2>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Suggested creators will appear here</p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </CenteredContainer>

      {paywallPost && (
        <PaywallModal
          open={!!paywallPost}
          onOpenChange={(open) => !open && setPaywallPost(null)}
          type={paywallPost.visibility === "subscribers" ? "subscribe" : "ppv"}
          creatorName={paywallPost.creator?.display_name || "Creator"}
          creatorAvatar={paywallPost.creator?.avatar_url}
          price={(paywallPost.price_cents || 0) / 100}
          benefits={
            paywallPost.visibility === "subscribers"
              ? ["Access to all subscriber content", "New posts notifications"]
              : ["Unlock this content permanently", "Full quality access"]
          }
          postId={paywallPost.id}
          creatorId={paywallPost.creator_id}
          onSuccess={() => handlePaywallSuccess(paywallPost.id)}
        />
      )}

      <BottomNavigation notificationCount={0} userRole={currentUser?.role} />
    </div>
  );
}
