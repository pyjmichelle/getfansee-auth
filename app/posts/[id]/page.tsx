"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PostLikeButton } from "@/components/post-like-button";
import { CommentList } from "@/components/comments/comment-list";
import { MediaDisplay } from "@/components/media-display";
import { PaywallModal } from "@/components/paywall-modal";
import { PageShell } from "@/components/page-shell";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { type Post } from "@/lib/types";
import Link from "next/link";
import { ArrowLeft, Share2, Lock, MessageCircle, Heart } from "@/lib/icons";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Analytics } from "@/lib/analytics";
import { useCountUp } from "@/hooks/use-count-up";
import { DEFAULT_AVATAR_CREATOR } from "@/lib/image-fallbacks";

const supabase = getSupabaseBrowserClient();

/* -------------------------------------------------------------------------- */
/* Skeleton                                                                     */
/* -------------------------------------------------------------------------- */
function PostDetailSkeleton() {
  return (
    <div className="pt-14 max-w-6xl mx-auto px-4 md:px-6 flex flex-col lg:flex-row gap-6 py-6">
      <div className="flex-1 space-y-4">
        {/* Creator */}
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
          </div>
        </div>
        {/* Title */}
        <Skeleton className="h-7 w-3/4 rounded" />
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-5/6 rounded" />
        {/* Media */}
        <Skeleton className="w-full aspect-video rounded-2xl" />
        {/* Actions */}
        <div className="flex gap-3">
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-9 w-20 rounded-xl" />
        </div>
      </div>
      {/* Sidebar skeleton (desktop) */}
      <div className="hidden lg:block w-80 shrink-0 space-y-4">
        <Skeleton className="h-6 w-24 rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-9 h-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-3 w-48 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PostDetailPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params?.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const [canView, setCanView] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const socialUnlockCount = useCountUp(0, { duration: 900, decimals: 0 });

  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === "true";

  const MOCK_POSTS: Record<string, { post: Post; canView: boolean }> = {
    "mock-post-1": {
      canView: true,
      post: {
        id: "mock-post-1",
        title: "Behind the Scenes — Exclusive Photoshoot",
        content:
          "Welcome to my exclusive behind-the-scenes content! In this post, I share everything that goes into creating stunning photography. From the initial concept to the final edit, you'll see it all.",
        creator_id: "mock-creator-1",
        visibility: "ppv",
        price_cents: 1500,
        media_urls: ["/images/placeholders/post-media-1-pc.jpg"],
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        likes_count: 284,
        comments_count: 47,
        creator: {
          id: "mock-creator-1",
          display_name: "Elena Rose",
          avatar_url: "/creator-avatar.png",
          bio: "Professional photographer & content creator based in LA.",
          verified: true,
          subscribers_count: 1840,
          subscription_price_cents: 999,
        },
      } as unknown as Post,
    },
    "mock-post-locked": {
      canView: false,
      post: {
        id: "mock-post-locked",
        title: "Summer Collection Preview — Members Only",
        content: "Subscribe to unlock this exclusive content from Maya Styles.",
        creator_id: "mock-creator-2",
        visibility: "subscriber",
        price_cents: 0,
        media_urls: [],
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        likes_count: 512,
        comments_count: 93,
        creator: {
          id: "mock-creator-2",
          display_name: "Maya Styles",
          avatar_url: "/artist-creator-avatar.jpg",
          bio: "Fashion & lifestyle creator.",
          verified: true,
          subscribers_count: 3200,
          subscription_price_cents: 799,
        },
      } as unknown as Post,
    },
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Test mode: serve mock data for mock post IDs
        if (isTestMode && MOCK_POSTS[postId]) {
          const mock = MOCK_POSTS[postId];
          setCurrentUser({
            id: "mock-fan-user",
            username: "test-user",
            role: "fan",
            avatar: "/fan-user-avatar.jpg",
          });
          setPost(mock.post);
          setCanView(mock.canView);
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          if (isTestMode) {
            // Fallback: show mock unlocked post
            const fallback = MOCK_POSTS["mock-post-1"];
            setCurrentUser({ id: "mock-fan-user", username: "test-user", role: "fan" });
            setPost(fallback.post);
            setCanView(true);
            return;
          }
          router.push("/auth");
          return;
        }

        await ensureProfile();
        const profile = await getProfile(session.user.id);
        if (profile) {
          setCurrentUser({
            id: session.user.id,
            username: profile.display_name || "user",
            role: (profile.role || "fan") as "fan" | "creator",
            avatar: profile.avatar_url || undefined,
          });
        }

        const response = await fetch(`/api/posts/${postId}`);
        if (!response.ok) {
          if (isTestMode) {
            const fallback = MOCK_POSTS["mock-post-1"];
            setPost(fallback.post);
            setCanView(true);
            return;
          }
          throw new Error("Failed to load post");
        }

        const data = await response.json();
        if (!data.success) {
          if (isTestMode) {
            const fallback = MOCK_POSTS["mock-post-1"];
            setPost(fallback.post);
            setCanView(true);
            return;
          }
          throw new Error(data.error || "Failed to load post");
        }

        setPost(data.post);

        const isCreator = data.post.creator_id === session.user.id;
        const isFree = data.post.visibility === "free";
        setCanView(isCreator || isFree || data.canView || false);

        Analytics.contentViewed(
          data.post.id,
          data.post.creator_id || "",
          data.post.visibility || "free",
          !(isCreator || isFree || data.canView)
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load post";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [postId, router]);

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: post?.title || "Check out this post", url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
  };

  const refetchCanView = async () => {
    if (!postId) return;
    try {
      const res = await fetch(`/api/posts/${postId}`);
      const data = await res.json();
      if (data?.success && data.canView) setCanView(true);
    } catch {
      // ignore
    }
  };

  if (isLoading) {
    return (
      <PageShell user={currentUser} notificationCount={0} noPadding>
        <div data-testid="post-detail-page">
          <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border-base">
            <div className="flex items-center justify-center px-4 h-14">
              <h1 className="font-semibold text-text-primary">Post</h1>
            </div>
          </header>
          <PostDetailSkeleton />
        </div>
      </PageShell>
    );
  }

  if (error || !post) {
    return (
      <PageShell user={currentUser} notificationCount={0} noPadding>
        <div data-testid="post-page-error">
          <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border-base">
            <div className="flex items-center px-4 h-14">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => router.back()}
                aria-label="Go back"
                className="text-text-primary active:scale-95"
              >
                <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              </Button>
            </div>
          </header>
          <div className="pt-20 px-4 text-center py-16">
            <p className="text-text-tertiary">{error || "Post not found"}</p>
            <Button className="mt-4" onClick={() => router.back()}>
              Go Back
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  const isCreator = currentUser?.id === post.creator_id;

  return (
    <PageShell user={currentUser} notificationCount={0} noPadding>
      <div data-testid="page-ready">
        {/* Fixed Header */}
        <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border-base">
          <div className="flex items-center justify-between px-4 h-14 max-w-6xl mx-auto">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => router.back()}
              aria-label="Go back"
              className="text-text-primary active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </Button>
            <h1 className="font-semibold text-text-primary truncate max-w-[200px]">
              {post.title || "Post"}
            </h1>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleShare}
              aria-label="Share this post"
              className="text-text-primary active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              <Share2 className="w-5 h-5" aria-hidden="true" />
            </Button>
          </div>
        </header>

        {/* Two-Column Layout: Main Content + Sidebar */}
        <div className="pt-14 max-w-6xl mx-auto px-4 md:px-6">
          <div className="flex flex-col lg:flex-row gap-6 py-4 lg:py-6">
            {/* ── MAIN CONTENT ── */}
            <article className="flex-1 min-w-0">
              {/* Creator Info */}
              <div className="flex items-center gap-3 py-3 border-b border-border-base mb-3">
                <Link href={`/creator/${post.creator_id}`}>
                  <Avatar className="w-10 h-10 cursor-pointer ring-2 ring-transparent hover:ring-brand-primary/30 transition-all">
                    <AvatarImage
                      src={post.creator?.avatar_url || DEFAULT_AVATAR_CREATOR}
                      alt={post.creator?.display_name || "Creator"}
                    />
                    <AvatarFallback className="bg-brand-primary-alpha-10 text-brand-primary text-sm font-semibold">
                      {post.creator?.display_name?.[0]?.toUpperCase() || "C"}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/creator/${post.creator_id}`}>
                    <h3 className="font-semibold text-text-primary hover:text-brand-primary transition-colors text-sm">
                      {post.creator?.display_name || "Creator"}
                    </h3>
                  </Link>
                  <p className="text-xs text-text-tertiary">
                    {post.created_at
                      ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
                      : "Unknown date"}
                  </p>
                </div>
                {post.visibility !== "free" && (
                  <Badge
                    variant={post.visibility === "ppv" ? "default" : "secondary"}
                    className="shrink-0"
                    data-testid="post-price-badge"
                  >
                    {post.visibility === "ppv"
                      ? `$${((post.price_cents || 0) / 100).toFixed(2)}`
                      : "Subscribers"}
                  </Badge>
                )}
              </div>

              {/* Title + Text */}
              <div className="mb-4">
                {post.title && (
                  <h2
                    className="text-2xl md:text-3xl font-bold text-text-primary mb-3 leading-tight"
                    data-testid="post-title"
                  >
                    {post.title}
                  </h2>
                )}
                {post.content && canView && (
                  <p
                    className="text-text-secondary text-sm md:text-base whitespace-pre-wrap leading-relaxed"
                    data-testid="post-content"
                  >
                    {post.content}
                  </p>
                )}
              </div>

              {/* Media - Full Width */}
              <div className="rounded-2xl overflow-hidden mb-4 bg-black" data-testid="post-media">
                <MediaDisplay
                  post={post}
                  canView={canView || isCreator}
                  isCreator={isCreator}
                  onSubscribe={() => setShowPaywallModal(true)}
                  onUnlock={() => setShowPaywallModal(true)}
                  creatorDisplayName={post.creator?.display_name}
                />
              </div>

              {/* Locked State */}
              {!canView && !isCreator && (
                <div
                  className="glass-card rounded-[var(--radius-md)] px-6 py-10 text-center mb-4"
                  data-testid="post-locked-overlay"
                >
                  <div className="size-16 mx-auto mb-4 bg-violet-500/10 rounded-full flex items-center justify-center border border-violet-500/20 shadow-glow-violet">
                    <Lock size={28} className="text-violet-400" aria-hidden="true" />
                  </div>
                  <h3 className="text-[16px] font-semibold mb-2 text-white">Premium Content</h3>
                  <p className="text-[13px] text-text-muted mb-2 max-w-sm mx-auto">
                    {post.visibility === "subscribers"
                      ? "This exclusive content is available for subscribers only"
                      : `Unlock this content for $${((post.price_cents || 0) / 100).toFixed(2)}`}
                  </p>
                  <p className="text-[12px] text-text-secondary mb-6">
                    <span className="font-bold text-amber-400">{socialUnlockCount.toFixed(0)}</span>{" "}
                    people already unlocked this content.
                  </p>
                  <Button
                    variant={post.visibility === "subscribers" ? "violet" : "gold"}
                    size="lg"
                    className="px-8 shadow-glow-violet active:scale-95"
                    data-testid={
                      post.visibility === "subscribers"
                        ? "post-subscribe-button"
                        : "post-unlock-button"
                    }
                    onClick={() => setShowPaywallModal(true)}
                  >
                    <Lock size={16} className="mr-1.5" />
                    {post.visibility === "subscribers" ? "Subscribe to Unlock" : "Unlock Now"}
                  </Button>
                </div>
              )}

              {/* Actions Bar */}
              <div className="py-3 flex items-center gap-2 border-t border-border-base">
                {currentUser && (
                  <PostLikeButton
                    postId={post.id}
                    initialLikesCount={post.likes_count || 0}
                    userId={currentUser.id}
                  />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-text-tertiary hover:text-brand-primary hover:bg-brand-primary/5 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
                  onClick={handleShare}
                  aria-label="Share this post"
                >
                  <Share2 className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden sm:inline text-sm">Share</span>
                </Button>
                <Button
                  variant="tip-gradient"
                  size="sm"
                  className="ml-auto gap-1.5 rounded-full px-4 active:scale-95"
                  onClick={() => toast.info("Tip feature coming soon!")}
                >
                  <span className="hidden sm:inline">Send Tip</span>
                  <span className="sm:hidden">Tip</span>
                </Button>
              </div>

              {/* Mobile: Comments inline */}
              {currentUser && (
                <div className="lg:hidden border-t border-border-base mt-2">
                  <CommentList
                    postId={postId}
                    currentUserId={currentUser.id}
                    canComment={canView || isCreator}
                  />
                </div>
              )}
            </article>

            {/* ── SIDEBAR (Desktop only) ── */}
            <aside className="hidden lg:block w-80 shrink-0">
              <div className="sticky top-20 space-y-4">
                {/* Creator Card */}
                <div className="card-block p-5">
                  <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-brand-primary" />
                    About the Creator
                  </h3>
                  <Link
                    href={`/creator/${post.creator_id}`}
                    className="flex items-center gap-3 group"
                  >
                    <Avatar className="w-12 h-12 ring-2 ring-transparent group-hover:ring-brand-primary/30 transition-all">
                      <AvatarImage
                        src={post.creator?.avatar_url || DEFAULT_AVATAR_CREATOR}
                        alt={post.creator?.display_name || "Creator"}
                      />
                      <AvatarFallback className="bg-brand-primary-alpha-10 text-brand-primary font-semibold">
                        {post.creator?.display_name?.[0]?.toUpperCase() || "C"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-text-primary group-hover:text-brand-primary transition-colors">
                        {post.creator?.display_name || "Creator"}
                      </p>
                      <p className="text-xs text-text-tertiary">View Profile</p>
                    </div>
                  </Link>
                  {!isCreator && (
                    <Button
                      variant="violet"
                      className="w-full mt-4 shadow-glow-violet"
                      onClick={() => setShowPaywallModal(true)}
                    >
                      Subscribe
                    </Button>
                  )}
                </div>

                {/* Post Stats */}
                <div className="card-block p-5">
                  <h3 className="text-sm font-semibold text-text-primary mb-3">Post Stats</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between text-text-secondary">
                      <span className="flex items-center gap-1.5">
                        <Heart className="w-4 h-4 text-error" aria-hidden="true" />
                        Likes
                      </span>
                      <span className="font-semibold text-text-primary">
                        {post.likes_count || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Desktop: Comments */}
                {currentUser && (
                  <div className="card-block overflow-hidden">
                    <CommentList
                      postId={postId}
                      currentUserId={currentUser.id}
                      canComment={canView || isCreator}
                    />
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>

        {post && (
          <PaywallModal
            open={showPaywallModal}
            onOpenChange={setShowPaywallModal}
            type={post.visibility === "subscribers" ? "subscribe" : "ppv"}
            creatorName={post.creator?.display_name || "Creator"}
            price={post.visibility === "ppv" ? (post.price_cents ?? 0) / 100 : 9.99}
            benefits={
              post.visibility === "subscribers"
                ? ["Exclusive content", "Direct support", "Early access"]
                : ["Instant access to this post", "Unlock all media"]
            }
            postId={post.visibility === "ppv" ? post.id : undefined}
            creatorId={post.creator_id}
            contentPreview={post.title || undefined}
            onSuccess={async () => {
              setShowPaywallModal(false);
              await refetchCanView();
            }}
          />
        )}
      </div>
    </PageShell>
  );
}
