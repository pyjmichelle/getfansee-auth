"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type Post } from "@/lib/types";
import { useUnlock } from "@/contexts/unlock-context";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Lock,
  Sparkles,
  TrendingUp,
  Flame,
  UserPlus,
  UserCheck,
  Loader2,
  DollarSign,
} from "@/lib/icons";
import { VerifiedBadge } from "@/components/verified-badge";
import { TipModal } from "@/components/tip-modal";
import { PaywallModal } from "@/components/paywall-modal";
import { ShareModal } from "@/components/share-modal";
import { DEFAULT_AVATAR_FAN } from "@/lib/image-fallbacks";
import { Analytics } from "@/lib/analytics";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

// Alpha: mirrors PaywallModal / lock-overlay — while no wallet top-up path
// exists in production, CTAs must not promise instant paid unlock/tip, and
// the wallet-spending Tip action is hidden (server also 403s /api/tip).
const WALLET_PATH_ACTIVE =
  process.env.NEXT_PUBLIC_TEST_MODE === "true" ||
  process.env.NEXT_PUBLIC_CRYPTO_TOPUP_ENABLED === "true";

interface HomeFeedClientProps {
  initialPosts: Post[];
  initialUnlockedStates: Map<string, boolean>;
  currentUser: {
    id: string;
    email: string;
    role?: string;
    user_metadata?: { avatar_url?: string };
    username?: string;
  } | null;
}

function PostCard({
  post,
  isUnlocked,
  onUnlock,
  onShare,
  onTip,
  isFollowing,
  onFollow,
  isFollowPending,
  currentUserId,
}: {
  post: Post;
  isUnlocked: boolean;
  onUnlock: () => void;
  onShare: () => void;
  onTip: (postId: string, creatorId: string, creatorName: string) => void;
  isFollowing: boolean;
  onFollow: (creatorId: string) => void;
  isFollowPending: boolean;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.isLikedByCurrentUser ?? false);
  const [likeCount, setLikeCount] = useState(post.likes_count ?? 0);
  const [isLiking, setIsLiking] = useState(false);
  const [isNavigatingToComments, setIsNavigatingToComments] = useState(false);

  const handle = post.creator?.display_name?.toLowerCase().replace(/\s+/g, "") || "user";
  const hasMedia = post.media && post.media.length > 0;
  const firstMedia = hasMedia ? post.media![0] : null;
  const mediaUrl = firstMedia?.media_url || post.media_url;
  const isVideo = firstMedia?.media_type === "video";
  const isLocked = post.visibility !== "free" && !isUnlocked;
  const shouldBlur = isLocked;
  const commentCount = (post as { comments_count?: number }).comments_count ?? 0;
  const postTimeLabel = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
    : "just now";

  const handleLike = async () => {
    if (!currentUserId) {
      toast.error("Please sign in to like posts");
      return;
    }
    if (isLiking) return;

    // Optimistic flip — rolled back below if the request fails, so the
    // button never claims a like/unlike that didn't actually persist.
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => (wasLiked ? Math.max(0, c - 1) : c + 1));
    setIsLiking(true);

    try {
      const res = await fetch(`/api/posts/${post.id}/like`, {
        method: wasLiked ? "DELETE" : "POST",
      });
      const data = await res.json();

      if (!res.ok && data.alreadyLiked) {
        // Already liked server-side (e.g. duplicate tab) — converge to liked.
        setLiked(true);
        setLikeCount(typeof data.likesCount === "number" ? data.likesCount : likeCount);
        return;
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to update like");
      }

      if (typeof data.likesCount === "number") {
        setLikeCount(data.likesCount);
      }
    } catch (err) {
      console.error("[home] like error", err);
      setLiked(wasLiked);
      setLikeCount((c) => (wasLiked ? c + 1 : Math.max(0, c - 1)));
      toast.error("Failed to update like. Please try again.");
    } finally {
      setIsLiking(false);
    }
  };

  const handleShare = () => {
    onShare();
  };

  return (
    <article
      data-testid="post-card"
      className="glass-card rounded-[var(--radius-lg)] overflow-hidden mb-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <Link href={`/creator/${post.creator_id}`} className="shrink-0">
          <Avatar className="size-8 ring-1 ring-[var(--wine)]/30 ring-offset-1 ring-offset-bg-base">
            <AvatarImage src={post.creator?.avatar_url || DEFAULT_AVATAR_FAN} />
            <AvatarFallback className="text-[10px]">
              {post.creator?.display_name?.[0] || "U"}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/creator/${post.creator_id}`}
              className="text-small font-semibold text-white hover:text-wine-text transition-colors truncate"
            >
              {post.creator?.display_name || "Unknown Creator"}
            </Link>
            {post.creator?.is_verified && <VerifiedBadge size={12} />}
            {post.visibility === "subscribers" && (
              <Badge variant="purple" className="text-[10px] py-0">
                Sub
              </Badge>
            )}
            {post.visibility === "ppv" && (
              <Badge variant="gold" className="text-[10px] py-0">
                PPV
              </Badge>
            )}
          </div>
          <p className="text-tiny text-text-muted">
            @{handle} · {postTimeLabel}
          </p>
        </div>

        {/* Free follow button — hidden for own posts */}
        {post.creator_id && currentUserId !== post.creator_id && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFollow(post.creator_id!);
            }}
            disabled={isFollowPending}
            data-testid="home-follow-btn"
            aria-label={isFollowing ? "Unfollow creator" : "Follow creator for free"}
            className={`shrink-0 flex items-center gap-1 h-7 px-2.5 rounded-full text-tiny font-semibold transition-all ${
              isFollowing
                ? "bg-[var(--wine)]/15 border border-[var(--wine)]/30 text-wine-text"
                : "bg-[var(--wine)]/90 hover:bg-[var(--wine)] text-white"
            } disabled:opacity-60`}
          >
            {isFollowPending ? (
              <span className="size-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : isFollowing ? (
              <>
                <UserCheck className="size-[11px]" />
                <span>Following</span>
              </>
            ) : (
              <>
                <UserPlus className="size-[11px]" />
                <span>Follow</span>
              </>
            )}
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="size-7 flex items-center justify-center rounded-full text-text-muted hover:text-white hover:bg-white/8 transition-colors"
              aria-label="More options"
            >
              <MoreHorizontal className="size-[14px]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => router.push(`/creator/${post.creator_id}`)}>
              View creator
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleShare}>Copy post link</DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/report?postId=${post.id}`)}>
              Report post
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Text content */}
      {post.content && (
        <div className="px-3.5 pb-2">
          <p className="text-small text-text-secondary leading-relaxed">{post.content}</p>
        </div>
      )}

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="px-3.5 pb-2.5 flex flex-wrap gap-1">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-[var(--wine)]/10 border border-[var(--wine)]/20 text-[10px] text-wine-text"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Media — render block for any locked post (even text-only) so the locked overlay is always visible */}
      {(mediaUrl || isLocked) && (
        <div className="relative w-full bg-black overflow-hidden aspect-[4/5] md:aspect-[16/9] md:max-h-[560px]">
          {isVideo ? (
            <div className="w-full h-full flex items-center justify-center bg-bg-elevated text-text-muted text-tiny">
              Video content
            </div>
          ) : mediaUrl ? (
            <img
              src={mediaUrl}
              alt="Post media"
              className={`w-full h-full object-cover transition-all ${shouldBlur ? "blur-[24px] scale-110 opacity-50" : ""}`}
            />
          ) : (
            <div className="w-full h-full bg-bg-elevated" />
          )}

          {/* Lock overlay */}
          {shouldBlur && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/50"
              data-testid="post-locked-preview"
            >
              <div className="flex items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full bg-[var(--wine)]/15 border border-[var(--wine)]/30">
                <Sparkles className="size-[11px] text-wine-text" />
                <span className="text-[10px] font-bold text-wine-text tracking-widest uppercase">
                  Exclusive
                </span>
              </div>

              <div className="size-12 rounded-full bg-white/8 border border-white/12 flex items-center justify-center mb-3 backdrop-blur-sm">
                <Lock className="size-5 text-white/80" />
              </div>

              <p className="text-small font-semibold text-white mb-0.5">Unlock Exclusive Content</p>
              <p className="text-tiny text-white/50 mb-4">
                {post.visibility === "subscribers"
                  ? "Subscribe for unlimited access"
                  : "One-time purchase"}
              </p>

              <Button
                variant="violet"
                onClick={onUnlock}
                data-testid="post-unlock-trigger"
                className="w-[200px] h-10 rounded-full text-small font-bold"
              >
                {WALLET_PATH_ACTIVE
                  ? post.visibility === "subscribers"
                    ? "Subscribe · $9.99/mo"
                    : `Unlock · $${((post.price_cents || 999) / 100).toFixed(2)}`
                  : "View Options"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-1 px-3 py-2.5">
        <button
          onClick={handleLike}
          disabled={isLiking}
          className={`flex items-center gap-1.5 h-8 px-2.5 rounded-full transition-all hover:bg-[var(--wine)]/10 disabled:opacity-70 ${liked ? "text-wine-text" : "text-text-muted hover:text-wine-text"}`}
          aria-label={liked ? "Unlike" : "Like"}
        >
          <Heart className={`size-[15px] ${liked ? "fill-[var(--wine)]" : ""}`} />
          <span className="text-tiny font-medium">{likeCount.toLocaleString()}</span>
        </button>

        <button
          onClick={() => {
            setIsNavigatingToComments(true);
            router.push(`/posts/${post.id}`);
          }}
          disabled={isNavigatingToComments}
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-full text-text-muted hover:text-white hover:bg-white/8 transition-all disabled:opacity-50"
          aria-label="View comments"
        >
          {isNavigatingToComments ? (
            <Loader2 className="size-[15px] animate-spin" />
          ) : (
            <MessageCircle className="size-[15px]" />
          )}
          <span className="text-tiny font-medium">{commentCount}</span>
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-full transition-all text-text-muted hover:text-white hover:bg-white/8"
          aria-label="Share"
        >
          <Share2 className="size-[15px]" />
          <span className="text-tiny font-medium">Share</span>
        </button>

        <div className="flex-1" />
        {WALLET_PATH_ACTIVE &&
          !isLocked &&
          post.creator_id &&
          post.creator_id !== currentUserId && (
            <button
              onClick={() =>
                onTip(post.id, post.creator_id!, post.creator?.display_name ?? "Creator")
              }
              className="flex items-center gap-1 h-8 px-2.5 rounded-full text-[var(--premium)] hover:bg-[var(--premium)]/10 transition-all text-tiny font-semibold"
              aria-label="Send tip"
            >
              <DollarSign className="size-[14px]" />
              Tip
            </button>
          )}
      </div>
    </article>
  );
}

export function HomeFeedClient({
  initialPosts,
  initialUnlockedStates,
  currentUser,
}: HomeFeedClientProps) {
  const { addUnlockedPost, isUnlocked: isUnlockedGlobal } = useUnlock();
  const [activeFeedTab, setActiveFeedTab] = useState<"for-you" | "following">("for-you");
  const [posts] = useState<Post[]>(initialPosts);
  const [paywallPost, setPaywallPost] = useState<Post | null>(null);
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [tipTarget, setTipTarget] = useState<{
    postId: string;
    creatorId: string;
    creatorName: string;
  } | null>(null);
  const [postViewStates] = useState<Map<string, boolean>>(initialUnlockedStates);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Free follow state (Pre-Payment Alpha): set of creator IDs the current user follows.
  const [followingCreatorIds, setFollowingCreatorIds] = useState<Set<string>>(new Set());
  // Currently-processing follow/unfollow action (creator ID or null)
  const [followPendingCreatorId, setFollowPendingCreatorId] = useState<string | null>(null);
  // Suggested creators (real data from the Alpha directory; replaces mock placeholders)
  const [suggestedCreators, setSuggestedCreators] = useState<
    { id: string; name: string; handle: string; avatar?: string }[]
  >([]);

  const trendingTags = ["Art", "Photography", "Fitness", "Design", "Music", "Travel"];

  // Load the user's existing follows on mount
  useEffect(() => {
    const loadFollows = async () => {
      try {
        const res = await fetch("/api/follow");
        if (!res.ok) return;
        const data = await res.json();
        setFollowingCreatorIds(new Set<string>(data.followingIds ?? []));
      } catch {
        // non-fatal — follow state starts empty
      }
    };
    if (currentUser) loadFollows();
  }, [currentUser]);

  // Load a handful of real creators to suggest (featured/trending in the directory)
  useEffect(() => {
    const loadSuggested = async () => {
      try {
        const res = await fetch("/api/creators/suggested?limit=4");
        if (!res.ok) return;
        const data = await res.json();
        const creators = (data.creators ?? []) as {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
        }[];
        setSuggestedCreators(
          creators
            .filter((c) => c.id !== currentUser?.id)
            .slice(0, 3)
            .map((c) => ({
              id: c.id,
              name: c.display_name || "Creator",
              handle: (c.display_name || "creator").toLowerCase().replace(/\s+/g, ""),
              avatar: c.avatar_url || undefined,
            }))
        );
      } catch {
        // non-fatal — sidebar just stays empty
      }
    };
    loadSuggested();
  }, [currentUser?.id]);

  const basePosts =
    activeFeedTab === "for-you"
      ? posts
      : posts.filter((p) => p.creator_id && followingCreatorIds.has(p.creator_id));
  const displayedPosts = selectedTag
    ? basePosts.filter((p) => p.tags?.includes(selectedTag))
    : basePosts;

  const handleTagClick = (tag: string) => {
    setSelectedTag((prev) => (prev === tag ? null : tag));
  };

  const handleUnlock = (post: Post) => setPaywallPost(post);
  const handleShare = (post: Post) => setSharePost(post);

  const handlePaywallSuccess = (postId: string) => {
    addUnlockedPost(postId);
    setPaywallPost(null);
    toast.success("Content unlocked!");
  };

  // Called when user clicks Follow/Following on a post card or suggested creator.
  // Free follow (Pre-Payment Alpha) — toggles immediately via /api/follow, no paywall.
  const handleFollowCreator = useCallback(
    async (creatorId: string) => {
      if (!currentUser) {
        toast.error("Please sign in to follow creators");
        return;
      }
      const isCurrentlyFollowing = followingCreatorIds.has(creatorId);
      setFollowPendingCreatorId(creatorId);
      try {
        const res = isCurrentlyFollowing
          ? await fetch(`/api/follow?creatorId=${creatorId}`, { method: "DELETE" })
          : await fetch("/api/follow", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ creatorId }),
            });
        const data = await res.json();
        if (data.success) {
          setFollowingCreatorIds((prev) => {
            const next = new Set(prev);
            if (data.following) {
              next.add(creatorId);
            } else {
              next.delete(creatorId);
            }
            return next;
          });
          if (data.following) {
            Analytics.creatorFollowed(creatorId);
            toast.success("Following!");
          }
        } else {
          toast.error(data.error || "Failed to update follow. Please try again.");
        }
      } catch (err) {
        console.error("[home] follow error", err);
        toast.error("Failed to update follow. Please try again.");
      } finally {
        setFollowPendingCreatorId(null);
      }
    },
    [currentUser, followingCreatorIds]
  );

  return (
    <PageShell
      user={
        currentUser
          ? {
              username: currentUser.username || currentUser.email,
              role: (currentUser.role as "fan" | "creator") || "fan",
              avatar: currentUser.user_metadata?.avatar_url,
            }
          : null
      }
      noPadding
      maxWidth="full"
    >
      <div className="home-layout" data-testid="home-feed">
        {/* ── Left sidebar (PC only) ──────────────────────── */}
        <aside className="home-sidebar hidden lg:block">
          <div className="sticky top-[var(--nav-height)] space-y-4">
            {/* Trending */}
            <div className="glass-card rounded-[var(--radius-md)] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="size-[14px] text-wine-text" />
                <h3 className="text-tiny font-semibold text-white uppercase tracking-wider">
                  Trending
                </h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {trendingTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleTagClick(tag)}
                    className={`px-2.5 py-1 rounded-full border text-tiny transition-all ${
                      selectedTag === tag
                        ? "bg-[var(--wine)] border-[var(--wine)] text-white"
                        : "bg-white/5 border-white/8 text-text-muted hover:text-white hover:border-[var(--wine)]/40 hover:bg-[var(--wine)]/8"
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick links */}
            <div className="glass-card rounded-[var(--radius-md)] p-4 space-y-1">
              {[
                { label: "Discover Creators", href: "/creators" },
                { label: "My Subscriptions", href: "/subscriptions" },
                { label: "Purchases", href: "/purchases" },
                { label: "Wallet", href: "/me/wallet" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center h-8 px-2 rounded-[var(--radius-sm)] text-tiny text-text-muted hover:text-white hover:bg-white/5 transition-all"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Main feed ──────────────────────────────────── */}
        <main className="home-feed min-w-0">
          {/* Feed tabs */}
          {/* Fully opaque — a semi-transparent backdrop-blur here let scrolled
              content show through, making the bar look like it was covering
              the first card's creator row underneath (F-002). */}
          <div
            className="sticky top-[var(--nav-height)] bg-bg-base border-b border-border-subtle mb-6"
            style={{ zIndex: "var(--z-sticky)" as unknown as number }}
          >
            {/* Trending tags scroll (mobile) */}
            <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto no-scrollbar lg:hidden">
              <TrendingUp className="size-[13px] text-wine-text shrink-0" />
              {trendingTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className={`shrink-0 min-h-11 px-2.5 py-1 rounded-full border text-tiny transition-colors ${
                    selectedTag === tag
                      ? "bg-[var(--wine)] border-[var(--wine)] text-white"
                      : "bg-white/5 border-white/8 text-text-muted hover:text-white hover:border-[var(--wine)]/40"
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>

            {/* For You / Following tabs */}
            <div className="flex">
              {(["for-you", "following"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveFeedTab(tab)}
                  className={`flex-1 min-h-11 text-tiny font-semibold relative transition-colors ${activeFeedTab === tab ? "text-white" : "text-text-muted hover:text-white"}`}
                >
                  {tab === "for-you" ? "For You" : "Following"}
                  {activeFeedTab === tab && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-[var(--wine)]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Active tag filter indicator */}
          {selectedTag && (
            <div className="flex items-center gap-2 px-1 mb-3">
              <span className="text-tiny text-text-muted">Filtering by</span>
              <span className="px-2 py-0.5 rounded-full bg-[var(--wine)]/20 border border-[var(--wine)]/30 text-tiny text-wine-text">
                #{selectedTag}
              </span>
              <button
                onClick={() => setSelectedTag(null)}
                className="text-tiny text-text-muted hover:text-white underline"
              >
                Clear
              </button>
            </div>
          )}

          {/* Posts */}
          {displayedPosts.length > 0 ? (
            <>
              {displayedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  isUnlocked={postViewStates.get(post.id) || isUnlockedGlobal(post.id)}
                  onUnlock={() => handleUnlock(post)}
                  onShare={() => handleShare(post)}
                  onTip={(postId, creatorId, creatorName) =>
                    setTipTarget({ postId, creatorId, creatorName })
                  }
                  isFollowing={!!post.creator_id && followingCreatorIds.has(post.creator_id)}
                  onFollow={handleFollowCreator}
                  isFollowPending={followPendingCreatorId === post.creator_id}
                  currentUserId={currentUser?.id ?? null}
                />
              ))}
              <div className="py-8 text-center">
                <p className="text-tiny text-text-disabled">You&apos;re all caught up</p>
              </div>
            </>
          ) : (
            <EmptyState
              icon={<Sparkles className="size-6" />}
              title={activeFeedTab === "following" ? "No subscriptions yet" : "No posts yet"}
              description={
                activeFeedTab === "following"
                  ? "Follow creators to see their exclusive content here."
                  : "Check back soon for fresh content from our creators."
              }
              action={
                activeFeedTab === "following"
                  ? { label: "Discover Creators", onClick: () => setActiveFeedTab("for-you") }
                  : undefined
              }
            />
          )}
        </main>

        {/* ── Right suggested sidebar (PC only) ─────────── */}
        <aside className="home-suggested hidden xl:block">
          <div className="sticky top-[var(--nav-height)] space-y-4">
            <div className="glass-card rounded-[var(--radius-md)] p-4">
              <h3 className="text-tiny font-semibold text-white uppercase tracking-wider mb-3">
                Suggested Creators
              </h3>
              {suggestedCreators.length > 0 ? (
                <div className="space-y-3">
                  {suggestedCreators.map((creator) => (
                    <div key={creator.id} className="flex items-center gap-2.5">
                      <Link href={`/creator/${creator.id}`} className="shrink-0">
                        <Avatar className="size-8 ring-1 ring-[var(--wine)]/20">
                          <AvatarImage src={creator.avatar} />
                          <AvatarFallback className="text-[10px]">{creator.name[0]}</AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <p className="text-tiny font-medium text-white truncate">{creator.name}</p>
                        <p className="text-[10px] text-text-muted">@{creator.handle}</p>
                      </div>
                      <Button
                        variant={followingCreatorIds.has(creator.id) ? "outline" : "violet"}
                        size="xs"
                        className="shrink-0 text-tiny h-6 px-2.5"
                        onClick={() => handleFollowCreator(creator.id)}
                        disabled={followPendingCreatorId === creator.id}
                      >
                        {followingCreatorIds.has(creator.id) ? "Following" : "Follow"}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-tiny text-text-disabled">
                  Check back soon for creator suggestions.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>

      <ShareModal
        open={!!sharePost}
        onClose={() => setSharePost(null)}
        url={
          sharePost
            ? `${typeof window !== "undefined" ? window.location.origin : ""}/posts/${sharePost.id}`
            : ""
        }
        title={sharePost?.content?.slice(0, 80) || "Check out this post on GetFanSee"}
      />

      {tipTarget && (
        <TipModal
          open={!!tipTarget}
          onOpenChange={(open) => !open && setTipTarget(null)}
          creatorId={tipTarget.creatorId}
          creatorName={tipTarget.creatorName}
          postId={tipTarget.postId}
        />
      )}

      {paywallPost && (
        <PaywallModal
          open={!!paywallPost}
          onOpenChange={(open) => !open && setPaywallPost(null)}
          type={paywallPost.visibility === "subscribers" ? "subscribe" : "ppv"}
          creatorName={paywallPost.creator?.display_name || "Creator"}
          creatorAvatar={paywallPost.creator?.avatar_url}
          price={
            paywallPost.visibility === "subscribers"
              ? // Use creator subscription price; fall back to 9.99 if not set
                (paywallPost.creator as { subscription_price_cents?: number } | undefined)
                  ?.subscription_price_cents
                ? ((paywallPost.creator as { subscription_price_cents?: number })
                    .subscription_price_cents ?? 999) / 100
                : 9.99
              : (paywallPost.price_cents || 999) / 100
          }
          billingPeriod="month"
          benefits={
            paywallPost.visibility === "subscribers"
              ? [
                  "Full access to all exclusive posts",
                  "Direct messaging with the creator",
                  "Early access to new content",
                  "Cancel anytime",
                ]
              : ["Unlock this post permanently", "Full resolution media", "Unlimited replays"]
          }
          postId={paywallPost.id}
          creatorId={paywallPost.creator_id}
          onSuccess={() => handlePaywallSuccess(paywallPost.id)}
        />
      )}
    </PageShell>
  );
}
