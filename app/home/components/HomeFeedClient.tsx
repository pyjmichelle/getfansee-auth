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
  CheckCircle2,
  UserPlus,
  UserCheck,
  Loader2,
} from "@/lib/icons";
import { PaywallModal } from "@/components/paywall-modal";
import { ShareModal } from "@/components/share-modal";
import { DEFAULT_AVATAR_FAN } from "@/lib/image-fallbacks";
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
  isSubscribed,
  onSubscribe,
  isSubscribing,
  currentUserId,
}: {
  post: Post;
  isUnlocked: boolean;
  onUnlock: () => void;
  onShare: () => void;
  isSubscribed: boolean;
  onSubscribe: (creatorId: string) => void;
  isSubscribing: boolean;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes_count ?? 0);
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

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount((c) => (liked ? c - 1 : c + 1));
  };

  const handleShare = () => {
    onShare();
  };

  return (
    <article className="glass-card rounded-[var(--radius-lg)] overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <Link href={`/creator/${post.creator_id}`} className="shrink-0">
          <Avatar className="size-8 ring-1 ring-violet-500/30 ring-offset-1 ring-offset-bg-base">
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
              className="text-[13px] font-semibold text-white hover:text-violet-400 transition-colors truncate"
            >
              {post.creator?.display_name || "Unknown Creator"}
            </Link>
            <CheckCircle2 className="size-[12px] text-violet-500 shrink-0" />
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
          <p className="text-[11px] text-text-muted">
            @{handle} · {postTimeLabel}
          </p>
        </div>

        {/* Follow/Subscribe button — hidden for own posts */}
        {post.creator_id && currentUserId !== post.creator_id && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSubscribe(post.creator_id!);
            }}
            disabled={isSubscribing}
            data-testid="home-follow-btn"
            aria-label={isSubscribed ? "Subscribed" : "Follow creator"}
            className={`shrink-0 flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-semibold transition-all ${
              isSubscribed
                ? "bg-violet-500/15 border border-violet-500/30 text-violet-400"
                : "bg-violet-500/90 hover:bg-violet-500 text-white shadow-glow-violet"
            } disabled:opacity-60`}
          >
            {isSubscribing ? (
              <span className="size-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : isSubscribed ? (
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
          <p className="text-[13px] text-text-secondary leading-relaxed">{post.content}</p>
        </div>
      )}

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="px-3.5 pb-2.5 flex flex-wrap gap-1">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-[10px] text-violet-400"
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
            <div className="w-full h-full flex items-center justify-center bg-bg-elevated text-text-muted text-[12px]">
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
              <div className="flex items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-500/30">
                <Sparkles className="size-[11px] text-violet-400" />
                <span className="text-[10px] font-bold text-violet-400 tracking-widest uppercase">
                  Exclusive
                </span>
              </div>

              <div className="size-12 rounded-full bg-white/8 border border-white/12 flex items-center justify-center mb-3 backdrop-blur-sm">
                <Lock className="size-5 text-white/80" />
              </div>

              <p className="text-[13px] font-semibold text-white mb-0.5">
                Unlock Exclusive Content
              </p>
              <p className="text-[11px] text-white/50 mb-4">
                {post.visibility === "subscribers"
                  ? "Subscribe for unlimited access"
                  : "One-time purchase"}
              </p>

              <Button
                variant="violet"
                onClick={onUnlock}
                data-testid="post-unlock-trigger"
                className="w-[200px] h-10 rounded-full text-[13px] font-bold"
              >
                {post.visibility === "subscribers"
                  ? "Subscribe · $9.99/mo"
                  : `Unlock · $${((post.price_cents || 999) / 100).toFixed(2)}`}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-1 px-3 py-2.5">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 h-8 px-2.5 rounded-full transition-all hover:bg-violet-500/10 ${liked ? "text-violet-500" : "text-text-muted hover:text-violet-500"}`}
          aria-label={liked ? "Unlike" : "Like"}
        >
          <Heart className={`size-[15px] ${liked ? "fill-violet-500" : ""}`} />
          <span className="text-[12px] font-medium">{likeCount.toLocaleString()}</span>
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
          <span className="text-[12px] font-medium">{commentCount}</span>
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-full transition-all text-text-muted hover:text-white hover:bg-white/8"
          aria-label="Share"
        >
          <Share2 className="size-[15px]" />
          <span className="text-[12px] font-medium">Share</span>
        </button>

        <div className="flex-1" />
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
  const [postViewStates] = useState<Map<string, boolean>>(initialUnlockedStates);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Subscription state: set of creator IDs the current user subscribes to
  const [subscribedCreatorIds, setSubscribedCreatorIds] = useState<Set<string>>(new Set());
  // Currently-processing subscribe action (creator ID or null)
  const [subscribingCreatorId, setSubscribingCreatorId] = useState<string | null>(null);
  // PaywallModal for subscribe flow triggered from feed
  const [subscribeTargetCreatorId, setSubscribeTargetCreatorId] = useState<string | null>(null);
  // Creator info cache for the subscribe modal (covers sidebar creators with no posts in feed)
  const [subscribeTargetInfo, setSubscribeTargetInfo] = useState<{
    name: string;
    avatar?: string;
    price: number;
  } | null>(null);

  const trendingTags = ["Art", "Photography", "Fitness", "Design", "Music", "Travel"];

  // Load user's existing subscriptions on mount
  useEffect(() => {
    const loadSubscriptions = async () => {
      try {
        const res = await fetch("/api/subscriptions");
        if (!res.ok) return;
        const data = await res.json();
        const ids: string[] = (data.subscriptions ?? []).map(
          (s: { creator_id: string }) => s.creator_id
        );
        setSubscribedCreatorIds(new Set(ids));
      } catch {
        // non-fatal — subscription state starts empty
      }
    };
    if (currentUser) loadSubscriptions();
  }, [currentUser]);

  const basePosts =
    activeFeedTab === "for-you"
      ? posts
      : posts.filter((p) => p.creator_id && subscribedCreatorIds.has(p.creator_id));
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

  // Called when user clicks Follow on a post card or suggested creator
  const handleFollowCreator = useCallback(
    async (
      creatorId: string,
      creatorOverride?: { name: string; avatar?: string; price?: number }
    ) => {
      if (!currentUser) {
        toast.error("Please sign in to follow creators");
        return;
      }
      if (subscribedCreatorIds.has(creatorId)) {
        return;
      }
      // Resolve creator info for the modal
      const postFromFeed = posts.find((p) => p.creator_id === creatorId);
      const name = creatorOverride?.name ?? postFromFeed?.creator?.display_name ?? "Creator";
      const avatar = creatorOverride?.avatar ?? postFromFeed?.creator?.avatar_url ?? undefined;
      const price =
        creatorOverride?.price ??
        ((postFromFeed?.creator as { subscription_price_cents?: number } | undefined)
          ?.subscription_price_cents ?? 999) / 100;

      setSubscribeTargetInfo({ name, avatar, price });
      setSubscribeTargetCreatorId(creatorId);
    },
    [currentUser, subscribedCreatorIds, posts]
  );

  // Called when PaywallModal subscribe succeeds from the feed
  const handleFeedSubscribeSuccess = useCallback(async () => {
    if (!subscribeTargetCreatorId) return;
    setSubscribingCreatorId(subscribeTargetCreatorId);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: subscribeTargetCreatorId }),
      });
      const data = await res.json();
      if (data.success) {
        setSubscribedCreatorIds((prev) => new Set([...prev, subscribeTargetCreatorId]));
        toast.success("You're now following this creator!");
      } else {
        toast.error(data.error || "Failed to subscribe. Please try again.");
        throw new Error(data.error);
      }
    } catch (err) {
      console.error("[home] subscribe error", err);
      throw err;
    } finally {
      setSubscribingCreatorId(null);
      setSubscribeTargetCreatorId(null);
      setSubscribeTargetInfo(null);
    }
  }, [subscribeTargetCreatorId]);

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
          <div className="sticky top-[60px] space-y-4">
            {/* Trending */}
            <div className="glass-card rounded-[var(--radius-md)] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="size-[14px] text-violet-500" />
                <h3 className="text-[12px] font-semibold text-white uppercase tracking-wider">
                  Trending
                </h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {trendingTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleTagClick(tag)}
                    className={`px-2.5 py-1 rounded-full border text-[11px] transition-all ${
                      selectedTag === tag
                        ? "bg-violet-500 border-violet-500 text-white shadow-glow-violet"
                        : "bg-white/5 border-white/8 text-text-muted hover:text-white hover:border-violet-500/40 hover:bg-violet-500/8"
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
                { label: "Discover Creators", href: "/search" },
                { label: "My Subscriptions", href: "/subscriptions" },
                { label: "Purchases", href: "/purchases" },
                { label: "Wallet", href: "/me/wallet" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center h-8 px-2 rounded-[var(--radius-sm)] text-[12px] text-text-muted hover:text-white hover:bg-white/5 transition-all"
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
          <div className="sticky top-12 md:top-[52px] z-30 bg-bg-base/95 backdrop-blur-md border-b border-white/6 mb-6">
            {/* Trending tags scroll (mobile) */}
            <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto no-scrollbar lg:hidden">
              <TrendingUp className="size-[13px] text-violet-500 shrink-0" />
              {trendingTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className={`shrink-0 px-2.5 py-1 rounded-full border text-[11px] transition-all ${
                    selectedTag === tag
                      ? "bg-violet-500 border-violet-500 text-white"
                      : "bg-white/5 border-white/8 text-text-muted hover:text-white hover:border-violet-500/40"
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
                  className={`flex-1 h-9 text-[12px] font-semibold relative transition-colors ${activeFeedTab === tab ? "text-white" : "text-text-muted hover:text-white"}`}
                >
                  {tab === "for-you" ? "For You" : "Following"}
                  {activeFeedTab === tab && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-violet-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Active tag filter indicator */}
          {selectedTag && (
            <div className="flex items-center gap-2 px-1 mb-3">
              <span className="text-[12px] text-text-muted">Filtering by</span>
              <span className="px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-[11px] text-violet-400">
                #{selectedTag}
              </span>
              <button
                onClick={() => setSelectedTag(null)}
                className="text-[11px] text-text-muted hover:text-white underline"
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
                  isSubscribed={!!post.creator_id && subscribedCreatorIds.has(post.creator_id)}
                  onSubscribe={handleFollowCreator}
                  isSubscribing={subscribingCreatorId === post.creator_id}
                  currentUserId={currentUser?.id ?? null}
                />
              ))}
              <div className="py-8 text-center">
                <p className="text-[11px] text-text-disabled">You&apos;re all caught up</p>
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
          <div className="sticky top-[60px] space-y-4">
            <div className="glass-card rounded-[var(--radius-md)] p-4">
              <h3 className="text-[12px] font-semibold text-white uppercase tracking-wider mb-3">
                Suggested Creators
              </h3>
              <div className="space-y-3">
                {[
                  {
                    name: "Sophia Creative",
                    handle: "sophiacreative",
                    id: "mock-creator-1",
                    price: 9.99,
                    avatar:
                      "https://ui-avatars.com/api/?name=Sophia+Creative&background=6366f1&color=fff&size=80&bold=true",
                  },
                  {
                    name: "Emma Lifestyle",
                    handle: "emmalifestyle",
                    id: "mock-creator-3",
                    price: 5.99,
                    avatar:
                      "https://ui-avatars.com/api/?name=Emma+Life&background=f59e0b&color=fff&size=80&bold=true",
                  },
                  {
                    name: "Marcus Fitness",
                    handle: "marcusfit",
                    id: "mock-creator-4",
                    price: 12.99,
                    avatar:
                      "https://ui-avatars.com/api/?name=Marcus+Fit&background=ef4444&color=fff&size=80&bold=true",
                  },
                ].map((creator) => (
                  <div key={creator.handle} className="flex items-center gap-2.5">
                    <Link href={`/creator/${creator.id}`} className="shrink-0">
                      <Avatar className="size-8 ring-1 ring-violet-500/20">
                        <AvatarImage src={creator.avatar} />
                        <AvatarFallback className="text-[10px]">{creator.name[0]}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-white truncate">{creator.name}</p>
                      <p className="text-[10px] text-text-muted">@{creator.handle}</p>
                    </div>
                    <Button
                      variant={subscribedCreatorIds.has(creator.id) ? "outline" : "violet"}
                      size="xs"
                      className="shrink-0 text-[11px] h-6 px-2.5"
                      onClick={() =>
                        handleFollowCreator(creator.id, {
                          name: creator.name,
                          avatar: creator.avatar,
                          price: creator.price,
                        })
                      }
                      disabled={subscribingCreatorId === creator.id}
                    >
                      {subscribedCreatorIds.has(creator.id) ? "Following" : "Follow"}
                    </Button>
                  </div>
                ))}
              </div>
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

      {/* Subscribe modal triggered from Follow button in feed or suggested sidebar */}
      {subscribeTargetCreatorId && subscribeTargetInfo && (
        <PaywallModal
          open={!!subscribeTargetCreatorId}
          onOpenChange={(open) => {
            if (!open) {
              setSubscribeTargetCreatorId(null);
              setSubscribeTargetInfo(null);
            }
          }}
          type="subscribe"
          creatorName={subscribeTargetInfo.name}
          creatorAvatar={subscribeTargetInfo.avatar}
          price={subscribeTargetInfo.price}
          billingPeriod="month"
          benefits={[
            "Full access to all exclusive posts",
            "Direct messaging with the creator",
            "Early access to new content",
            "Cancel anytime",
          ]}
          creatorId={subscribeTargetCreatorId}
          onSuccess={handleFeedSubscribeSuccess}
        />
      )}
    </PageShell>
  );
}
