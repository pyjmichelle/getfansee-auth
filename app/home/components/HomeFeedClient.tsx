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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CenteredContainer } from "@/components/layouts/centered-container";
import { LoadingState } from "@/components/loading-state";

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
      setError("Failed to load");
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
      toast.error("Subscription failed");
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
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  if (isLoading && posts.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <NavHeader user={currentUser!} />
        <CenteredContainer className="py-12">
          <LoadingState type="spinner" text="Loading..." />
        </CenteredContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-ready">
      <NavHeader user={currentUser!} />

      <CenteredContainer maxWidth="7xl" className="py-6 sm:py-8 lg:py-10">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* 左侧边栏 - 仅桌面显示 */}
          <aside className="hidden lg:block lg:col-span-3 space-y-6 sticky top-20 self-start">
            <Card className="rounded-xl border shadow-sm">
              <CardHeader className="pb-3">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
                  Trending Creators
                </h2>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Coming soon...</p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border shadow-sm">
              <CardHeader className="pb-3">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Hash className="h-4 w-4 text-primary" aria-hidden="true" />
                  Popular Tags
                </h2>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Coming soon...</p>
              </CardContent>
            </Card>
          </aside>

          {/* 主内容区 */}
          <main className="lg:col-span-6">
            {posts.length === 0 ? (
              <Card className="rounded-xl border shadow-sm" data-testid="empty-state">
                <CardContent className="py-16 text-center">
                  <Users
                    className="h-16 w-16 mx-auto text-muted-foreground mb-4"
                    aria-hidden="true"
                  />
                  <h3 className="text-xl font-semibold mb-2">No Content Yet</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                    Follow some creators to see their content in your feed, or explore trending
                    content to discover new creators.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                      onClick={() => router.push("/discover")}
                      className="rounded-lg min-h-[44px]"
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Explore Creators
                    </Button>
                    {currentUser?.role === "fan" && (
                      <Button
                        variant="outline"
                        onClick={() => router.push("/creator/upgrade")}
                        className="rounded-lg min-h-[44px]"
                      >
                        Become a Creator
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {posts.map((post) => {
                  const isUnlocked = postViewStates.get(post.id) || false;
                  const isSubscribing = subscribingCreators.has(post.creator_id);

                  return (
                    <Card
                      key={post.id}
                      className="rounded-xl border shadow-sm hover:shadow-md transition-all duration-200"
                      data-testid="post-card"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-4">
                          <Link
                            href={`/creator/${post.creator_id}`}
                            className="flex items-center gap-3 hover:opacity-80 transition-opacity min-w-0 flex-1"
                          >
                            <Avatar className="h-10 w-10 ring-2 ring-background">
                              <AvatarImage
                                src={post.creator?.avatar_url || undefined}
                                alt={post.creator?.display_name || "Creator"}
                              />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {post.creator?.display_name?.[0]?.toUpperCase() || "C"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold truncate">
                                {post.creator?.display_name || "Creator"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(post.created_at), {
                                  addSuffix: true,
                                })}
                              </p>
                            </div>
                          </Link>

                          {post.creator_id !== currentUserId && !isUnlocked && (
                            <Button
                              size="sm"
                              onClick={() => handleSubscribe(post.creator_id)}
                              disabled={isSubscribing}
                              className="shrink-0 rounded-lg min-h-[36px]"
                            >
                              {isSubscribing ? "Subscribing..." : "Subscribe"}
                            </Button>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="pb-3">
                        {post.title && (
                          <Link href={`/posts/${post.id}`}>
                            <h3 className="text-lg font-bold mb-2 hover:text-primary transition-colors cursor-pointer line-clamp-2">
                              {post.title}
                            </h3>
                          </Link>
                        )}

                        {post.content && (
                          <p className="text-muted-foreground mb-4 line-clamp-3 text-sm">
                            {post.content}
                          </p>
                        )}

                        {isUnlocked ? (
                          <Link href={`/posts/${post.id}`}>
                            <div className="rounded-lg overflow-hidden cursor-pointer hover:opacity-95 transition-opacity">
                              <MediaDisplay
                                post={post}
                                canView={true}
                                isCreator={false}
                                creatorDisplayName={post.creator?.display_name}
                              />
                            </div>
                          </Link>
                        ) : (
                          <div className="relative rounded-lg overflow-hidden bg-muted/50 border border-border">
                            <div className="aspect-video flex flex-col items-center justify-center p-6">
                              <Lock
                                className="h-12 w-12 text-muted-foreground mb-3"
                                aria-hidden="true"
                              />
                              <p className="text-base font-semibold mb-1">Locked Content</p>
                              <p className="text-sm text-muted-foreground mb-4">
                                {post.price_cents
                                  ? `$${(post.price_cents / 100).toFixed(2)}`
                                  : "Subscribe to unlock"}
                              </p>
                              <Button
                                onClick={() => handleUnlock(post)}
                                className="rounded-lg min-h-[40px]"
                              >
                                Unlock Now
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>

                      <CardFooter className="pt-3 border-t flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <PostLikeButton
                            postId={post.id}
                            initialLikesCount={post.likes_count || 0}
                            userId={currentUser?.id || undefined}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/posts/${post.id}#comments`)}
                            className="rounded-lg min-h-[40px] gap-2"
                          >
                            <span className="text-sm">Comment</span>
                          </Button>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShare(post)}
                          className="rounded-lg min-h-[40px]"
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
          <aside className="hidden lg:block lg:col-span-3 space-y-6 sticky top-20 self-start">
            <Card className="rounded-xl border shadow-sm">
              <CardHeader className="pb-3">
                <h2 className="text-base font-semibold">Suggested Follows</h2>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Coming soon...</p>
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
    </div>
  );
}
