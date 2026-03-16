"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PostLikeButton } from "@/components/post-like-button";
import { PostGridItem } from "@/components/post-grid-item";
import { CommentList } from "@/components/comments/comment-list";
import { MediaDisplay } from "@/components/media-display";
import { PaywallModal } from "@/components/paywall-modal";
import { PageShell } from "@/components/page-shell";
import { getAuthBootstrap } from "@/lib/auth-bootstrap-client";
import { type Post } from "@/lib/types";
import Link from "next/link";
import { ArrowLeft, Share2, Lock, MessageCircle, MoreVertical, CheckCircle2 } from "@/lib/icons";
import { ShareModal } from "@/components/share-modal";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Analytics } from "@/lib/analytics";
import { useCountUp } from "@/hooks/use-count-up";
import { DEFAULT_AVATAR_CREATOR } from "@/lib/image-fallbacks";
import { MOCK_POSTS as MOCK_POSTS_DATA, MOCK_CREATORS } from "@/lib/mock-data";

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* Mock data (outside component to avoid recreation on every render)           */
/* -------------------------------------------------------------------------- */
const PAGE_MOCK_POSTS: Record<string, { post: Post; canView: boolean }> = {
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
  const [showShareModal, setShowShareModal] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [relatedPosts, setRelatedPosts] = useState<Post[]>([]);
  const socialUnlockCount = useCountUp(0, { duration: 900, decimals: 0 });

  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === "true";

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Test mode: serve mock data for mock post IDs
        if (isTestMode && PAGE_MOCK_POSTS[postId]) {
          const mock = PAGE_MOCK_POSTS[postId];
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

        const bootstrap = await getAuthBootstrap();
        if (!bootstrap.authenticated || !bootstrap.user) {
          if (isTestMode) {
            // Fallback: show mock unlocked post
            const fallback = PAGE_MOCK_POSTS["mock-post-1"];
            setCurrentUser({ id: "mock-fan-user", username: "test-user", role: "fan" });
            setPost(fallback.post);
            setCanView(true);
            return;
          }
          router.push("/auth");
          return;
        }

        if (bootstrap.profile) {
          setCurrentUser({
            id: bootstrap.user.id,
            username: bootstrap.profile.display_name || "user",
            role: (bootstrap.profile.role || "fan") as "fan" | "creator",
            avatar: bootstrap.profile.avatar_url || undefined,
          });
        }

        const response = await fetch(`/api/posts/${postId}`);
        if (!response.ok) {
          // Fallback to shared mock data (for demo post IDs)
          const mockPost = MOCK_POSTS_DATA.find((p) => p.id === postId);
          if (mockPost) {
            const mockCreator = MOCK_CREATORS.find((c) => c.id === mockPost.creator_id);
            setPost({
              ...mockPost,
              creator: mockCreator,
            } as Post);
            setCanView(mockPost.visibility === "free");
            const others = MOCK_POSTS_DATA.filter(
              (p) => p.creator_id === mockPost.creator_id && p.id !== postId
            ).slice(0, 6);
            setRelatedPosts(others.map((p) => ({ ...p, creator: mockCreator }) as Post));
            return;
          }
          if (isTestMode) {
            const fallback = PAGE_MOCK_POSTS["mock-post-1"];
            setPost(fallback.post);
            setCanView(true);
            return;
          }
          throw new Error("Failed to load post");
        }

        const data = await response.json();
        if (!data.success) {
          // Fallback to shared mock data
          const mockPost = MOCK_POSTS_DATA.find((p) => p.id === postId);
          if (mockPost) {
            const mockCreator = MOCK_CREATORS.find((c) => c.id === mockPost.creator_id);
            setPost({
              ...mockPost,
              creator: mockCreator,
            } as Post);
            setCanView(mockPost.visibility === "free");
            return;
          }
          if (isTestMode) {
            const fallback = PAGE_MOCK_POSTS["mock-post-1"];
            setPost(fallback.post);
            setCanView(true);
            return;
          }
          throw new Error(data.error || "Failed to load post");
        }

        setPost(data.post);

        const isCreator = data.post.creator_id === bootstrap.user.id;
        const isFree = data.post.visibility === "free";
        setCanView(isCreator || isFree || data.canView || false);

        // Fetch related posts + subscription status in parallel
        if (data.post.creator_id) {
          const [relRes, subRes] = await Promise.allSettled([
            fetch(`/api/creator/${data.post.creator_id}/posts`),
            fetch(`/api/subscription/status?creatorId=${data.post.creator_id}`),
          ]);
          if (relRes.status === "fulfilled" && relRes.value.ok) {
            const relData = await relRes.value.json();
            const others = (relData.posts || []).filter((p: Post) => p.id !== postId).slice(0, 6);
            setRelatedPosts(others);
          }
          if (subRes.status === "fulfilled" && subRes.value.ok) {
            const subData = await subRes.value.json();
            setIsSubscribed(subData.isSubscribed === true);
          }
        }

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
    setShowShareModal(true);
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
          <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border-base md:hidden">
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
          <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border-base md:hidden">
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
  const creatorUsername =
    "@" + (post.creator?.display_name || "creator").replace(/\s+/g, "_").toLowerCase();

  return (
    <PageShell user={currentUser} notificationCount={0} noPadding>
      <div data-testid="page-ready">
        {/* Mobile-only Fixed Header */}
        <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-white/6 md:hidden">
          <div className="flex items-center justify-between px-4 h-14 max-w-3xl mx-auto">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => router.back()}
              aria-label="Go back"
              className="text-white active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </Button>
            <h1 className="font-semibold text-white">Post</h1>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleShare}
              aria-label="More options"
              className="text-white active:scale-95"
            >
              <MoreVertical className="w-5 h-5" aria-hidden="true" />
            </Button>
          </div>
        </header>

        {/* Single-column content */}
        <div className="pt-14 md:pt-4 max-w-3xl mx-auto px-4 md:px-6 pb-28">
          {/* Desktop inline back row */}
          <div className="hidden md:flex items-center gap-3 mb-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => router.back()}
              aria-label="Go back"
              className="text-white/70 hover:text-white active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </Button>
            <span className="text-[14px] text-text-muted">Back</span>
            <div className="ml-auto">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleShare}
                aria-label="Share"
                className="text-white/70 hover:text-white active:scale-95"
              >
                <MoreVertical className="w-5 h-5" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <article className="py-4">
            {/* Creator Info Row */}
            <div className="flex items-center gap-3 mb-4">
              <Link href={`/creator/${post.creator_id}`} className="shrink-0">
                <Avatar className="w-10 h-10 cursor-pointer ring-2 ring-transparent hover:ring-violet-500/30 transition-all">
                  <AvatarImage
                    src={post.creator?.avatar_url || DEFAULT_AVATAR_CREATOR}
                    alt={post.creator?.display_name || "Creator"}
                  />
                  <AvatarFallback className="bg-violet-500/20 text-violet-300 text-sm font-semibold">
                    {post.creator?.display_name?.[0]?.toUpperCase() || "C"}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/creator/${post.creator_id}`}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="font-semibold text-white text-[14px] hover:text-violet-300 transition-colors">
                      {post.creator?.display_name || "Creator"}
                    </span>
                    <CheckCircle2 size={13} className="text-violet-400" aria-hidden="true" />
                  </span>
                </Link>
                <p className="text-[12px] text-text-muted">
                  {creatorUsername}
                  {post.created_at && (
                    <>
                      {" · "}
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: false })} ago
                    </>
                  )}
                </p>
              </div>
              {!isCreator &&
                (isSubscribed ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full h-7 px-3.5 text-[12px] shrink-0 border-violet-500/40 text-violet-300"
                    disabled
                  >
                    ✓ Subscribed
                  </Button>
                ) : (
                  <Button
                    variant="violet"
                    size="sm"
                    className="rounded-full h-7 px-3.5 text-[12px] shrink-0"
                    onClick={() => setShowPaywallModal(true)}
                  >
                    Subscribe
                  </Button>
                ))}
            </div>

            {/* Text Content */}
            {post.content && canView && (
              <p
                className="text-[14px] text-text-secondary leading-relaxed whitespace-pre-wrap mb-4"
                data-testid="post-content"
              >
                {post.content}
              </p>
            )}

            {/* Media */}
            <div className="rounded-2xl overflow-hidden mb-3 bg-black" data-testid="post-media">
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
            <div className="flex items-center gap-3 py-2 border-t border-white/6 mb-1">
              {currentUser && (
                <PostLikeButton
                  postId={post.id}
                  initialLikesCount={post.likes_count || 0}
                  userId={currentUser.id}
                />
              )}
              <button
                className="flex items-center gap-1.5 text-text-muted hover:text-white transition-colors text-[13px] cursor-pointer focus-visible:outline-2 focus-visible:outline-violet-500 focus-visible:rounded"
                onClick={() => {
                  document
                    .getElementById("comment-section")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                aria-label="View comments"
              >
                <MessageCircle size={18} aria-hidden="true" />
                <span>{post.likes_count || 0}</span>
              </button>
              <button
                className="flex items-center gap-1.5 text-text-muted hover:text-white transition-colors text-[13px] cursor-pointer focus-visible:outline-2 focus-visible:outline-violet-500 focus-visible:rounded"
                onClick={handleShare}
                aria-label="Share"
              >
                <Share2 size={18} aria-hidden="true" />
              </button>
              <Button
                variant="tip-gradient"
                size="sm"
                className="ml-auto rounded-full px-4 h-8 gap-1.5 active:scale-95 font-semibold"
                onClick={() => toast.info("Tip feature coming soon!")}
              >
                <span className="text-[13px]">Tip</span>
              </Button>
            </div>

            {/* Like count */}
            <p className="text-[13px] font-semibold text-white mb-3">
              {post.likes_count || 0} likes
            </p>

            {/* Comments Section */}
            <div id="comment-section" className="border-t border-white/6 pt-3">
              {currentUser && (
                <CommentList
                  postId={postId}
                  currentUserId={currentUser.id}
                  canComment={canView || isCreator}
                />
              )}
            </div>

            {/* More from creator */}
            {relatedPosts.length > 0 && (
              <div className="mt-8 border-t border-white/6 pt-6">
                <h3 className="text-[14px] font-semibold text-white mb-3">
                  More from {creatorUsername}
                </h3>
                <div className="grid grid-cols-3 gap-0.5">
                  {relatedPosts.map((rp) => (
                    <PostGridItem key={rp.id} post={rp} currentUserId={currentUser?.id} />
                  ))}
                </div>
              </div>
            )}
          </article>
        </div>

        <ShareModal
          open={showShareModal}
          onClose={() => setShowShareModal(false)}
          url={typeof window !== "undefined" ? window.location.href : ""}
          title={post?.title || post?.content?.slice(0, 80) || "Check out this post on GetFanSee"}
        />

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
              if (post.visibility === "subscribers") setIsSubscribed(true);
              await refetchCanView();
            }}
          />
        )}
      </div>
    </PageShell>
  );
}
