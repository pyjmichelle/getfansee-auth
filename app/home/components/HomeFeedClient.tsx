"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { type Post } from "@/lib/types";
import { MediaDisplay } from "@/components/media-display";
import { useUnlock } from "@/contexts/unlock-context";
import { PostLikeButton } from "@/components/post-like-button";
import Link from "next/link";
import { Lock, Share2, AlertCircle, TrendingUp, Users } from "lucide-react";
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

      {/* Main Content - Figma Layout */}
      <main className="pt-14 md:pt-16">
        <div className="max-w-2xl mx-auto px-4 md:px-6">
          {/* Sticky Header */}
          <div className="sticky top-14 md:top-16 z-10 bg-background/95 backdrop-blur-lg border-b border-border-base py-3">
            <h1 className="text-lg font-semibold text-text-primary">Feed</h1>
          </div>

          {error && (
            <Alert variant="destructive" className="mx-4 mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Feed Content */}
          <div
            className="divide-y divide-border-base"
            role="main"
            aria-label="Home feed"
            data-testid="home-feed"
          >
            {posts.length === 0 ? (
              <div className="py-16 px-6 text-center" data-testid="empty-state">
                <div className="w-16 h-16 mx-auto rounded-full bg-brand-primary/10 flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-brand-primary" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-text-primary">Your Feed Is Empty</h3>
                <p className="text-text-tertiary text-sm max-w-sm mx-auto mb-5">
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
              </div>
            ) : (
              <>
                {posts.map((post, index) => {
                  const isUnlocked = postViewStates.get(post.id) || false;
                  const creatorId = post.creator_id;
                  const isSubscribing = creatorId ? subscribingCreators.has(creatorId) : false;

                  return (
                    <article
                      key={post.id}
                      className="bg-surface-base"
                      style={index > 10 ? { contentVisibility: "auto" as const } : undefined}
                      data-testid="post-card"
                      data-post-id={post.id}
                    >
                      {/* Creator Header - Compact Figma Style */}
                      <div className="px-3 py-2.5 flex items-center gap-2.5">
                        <Link
                          href={`/creator/${post.creator_id}`}
                          className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-transparent hover:ring-brand-primary/30 transition-all"
                          aria-label={`View ${post.creator?.display_name || "creator"}'s profile`}
                        >
                          <Avatar className="w-full h-full">
                            <AvatarImage
                              src={post.creator?.avatar_url || undefined}
                              alt={post.creator?.display_name || "Creator"}
                              className="object-cover"
                            />
                            <AvatarFallback className="bg-brand-primary-alpha-10 text-brand-primary text-sm font-semibold">
                              {post.creator?.display_name?.[0]?.toUpperCase() || "C"}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/creator/${post.creator_id}`}
                            className="text-sm font-semibold truncate text-text-primary hover:text-brand-primary transition-colors block"
                          >
                            {post.creator?.display_name || "Creator"}
                          </Link>
                          <p className="text-xs text-text-tertiary">
                            {post.created_at
                              ? formatDistanceToNow(new Date(post.created_at), {
                                  addSuffix: true,
                                })
                              : "Unknown date"}
                          </p>
                        </div>

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
                            className="shrink-0 rounded-full px-4"
                            aria-label={
                              isSubscribing
                                ? `Subscribing to ${post.creator?.display_name || "creator"}…`
                                : `Subscribe to ${post.creator?.display_name || "creator"}`
                            }
                          >
                            {isSubscribing ? "..." : "Subscribe"}
                          </Button>
                        )}
                      </div>

                      {/* Content Text */}
                      {(post.title || post.content) && (
                        <div className="px-3 pb-2.5">
                          {post.title && (
                            <Link
                              href={`/posts/${post.id}`}
                              aria-label={`View post: ${post.title}`}
                            >
                              <h3 className="text-sm font-semibold mb-1 hover:text-brand-primary transition-colors cursor-pointer line-clamp-2 text-text-primary">
                                {post.title}
                              </h3>
                            </Link>
                          )}
                          {post.content && (
                            <p className="text-text-secondary text-sm leading-relaxed line-clamp-2">
                              {post.content}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Media Content */}
                      {isUnlocked ? (
                        <Link
                          href={`/posts/${post.id}`}
                          aria-label={`View media for post: ${post.title || "Untitled"}`}
                        >
                          <div className="cursor-pointer hover:opacity-95 transition-opacity bg-black">
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
                          className="relative bg-black"
                          role="region"
                          aria-label="Locked content preview"
                          data-testid="post-locked-preview"
                        >
                          <div className="aspect-video flex flex-col items-center justify-center bg-gradient-to-b from-black/20 via-black/40 to-black/60">
                            <div className="w-16 h-16 rounded-full bg-brand-primary/20 backdrop-blur-md flex items-center justify-center mb-4 border border-brand-primary/30 shadow-glow">
                              <Lock className="h-7 w-7 text-brand-primary" aria-hidden="true" />
                            </div>
                            <p className="text-white/90 text-sm font-medium mb-1">
                              Unlock Exclusive Content
                            </p>
                            <p className="text-white/60 text-xs mb-4" aria-live="polite">
                              {post.price_cents
                                ? `$${(post.price_cents / 100).toFixed(2)}`
                                : "Subscribe to unlock"}
                            </p>
                            <Button
                              variant="subscribe-gradient"
                              size="lg"
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
                              <Lock className="w-5 h-5 mr-2" />
                              Unlock Now
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Actions Bar - Figma Style */}
                      <div className="px-3 py-2.5">
                        <div className="flex items-center gap-0.5">
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
                            className="gap-1.5 text-text-tertiary hover:text-brand-primary hover:bg-brand-primary/5"
                            aria-label={`View comments for post: ${post.title || "Untitled"}`}
                          >
                            <span className="text-sm">Comment</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleShare(post)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleShare(post);
                              }
                            }}
                            className="text-text-tertiary hover:text-brand-primary hover:bg-brand-primary/5"
                            aria-label="Share post"
                          >
                            <Share2 className="h-5 w-5" aria-hidden="true" />
                          </Button>

                          {/* Tip Button - Gold */}
                          <Button
                            variant="tip-gradient"
                            size="sm"
                            className="ml-auto gap-1.5 rounded-full px-4"
                            onClick={() => {
                              toast.info("Tip feature coming soon!");
                            }}
                          >
                            <span className="hidden sm:inline">Send Tip</span>
                            <span className="sm:hidden">Tip</span>
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </main>

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
