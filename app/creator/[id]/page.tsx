"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { type Post } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  FileText,
  Share2,
  ChevronLeft,
  Users,
  Star,
  CheckCircle2,
  MoreVertical,
  Plus,
  DollarSign,
  ExternalLink,
  Heart,
  Bookmark,
} from "@/lib/icons";
import { VerifiedBadge } from "@/components/verified-badge";
import { FoundingCreatorBadge } from "@/components/founding-creator-badge";
import { NewsletterSignup } from "@/components/newsletter-signup";
import type { PublicExternalLink } from "@/lib/external-links";
import { PaywallModal } from "@/components/paywall-modal";
import { TipModal } from "@/components/tip-modal";
import { SupportBlock } from "@/components/support-block";
import { PostGridItem } from "@/components/post-grid-item";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Analytics } from "@/lib/analytics";
import { ErrorState } from "@/components/error-state";
import { DEFAULT_AVATAR_CREATOR } from "@/lib/image-fallbacks";
import { useCountUp } from "@/hooks/use-count-up";
import { MOCK_CREATORS, MOCK_POSTS } from "@/lib/mock-data";
import { formatUsd, formatCountCompact } from "@/lib/format";

/* -------------------------------------------------------------------------- */
/* Constants (outside component to avoid re-creation on every render)          */
/* -------------------------------------------------------------------------- */
const CONTENT_FILTERS = ["All", "Photos", "Videos", "Behind the Scenes", "Exclusive", "Collab"];

// Alpha: mirrors PaywallModal — no wallet top-up path exists in production,
// so Tip (spends wallet balance) is hidden outside test/dev (server also
// 403s /api/tip as a backstop).
const WALLET_PATH_ACTIVE =
  process.env.NEXT_PUBLIC_TEST_MODE === "true" ||
  process.env.NEXT_PUBLIC_CRYPTO_TOPUP_ENABLED === "true";

/* -------------------------------------------------------------------------- */
/* Skeleton                                                                     */
/* -------------------------------------------------------------------------- */
function CreatorProfileSkeleton() {
  return (
    <>
      {/* Banner */}
      <div className="relative mt-14 h-48 md:h-64">
        <Skeleton className="w-full h-full" />
      </div>
      {/* Avatar + info */}
      <div className="px-4 md:px-6 -mt-12 mb-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex items-end gap-4">
            <Skeleton className="w-24 h-24 md:w-28 md:h-28 rounded-2xl flex-shrink-0" />
            <div className="pb-2 space-y-2">
              <Skeleton className="h-6 w-40 rounded" />
              <Skeleton className="h-4 w-64 rounded" />
            </div>
          </div>
          <Skeleton className="h-10 w-36 rounded-xl hidden md:block" />
        </div>
      </div>
      {/* Stats */}
      <div className="px-4 md:px-6 mb-6 grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      {/* Posts */}
      <div className="px-4 md:px-6 space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    </>
  );
}

export default function CreatorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const creatorId = (params?.id as string) || "";
  // SSR-injected via AuthProvider — synchronously available on first render (P-1).
  const auth = useAuth();
  const viewerId = auth.authenticated && auth.user ? auth.user.id : null;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatorProfile, setCreatorProfile] = useState<{
    id: string;
    display_name?: string;
    bio?: string;
    avatar_url?: string;
    is_verified?: boolean;
    is_founding_creator?: boolean;
    category?: string | null;
    external_links?: PublicExternalLink[];
    tags?: string[];
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
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [showPpvModal, setShowPpvModal] = useState(false);
  const [selectedPpvPost, setSelectedPpvPost] = useState<{
    id: string;
    price: number;
    title?: string;
  } | null>(null);
  const [subscriptionPrice, setSubscriptionPrice] = useState(9.99);
  const [postViewStates, setPostViewStates] = useState<Map<string, boolean>>(new Map());
  const [activeTab, setActiveTab] = useState<"posts" | "about">("posts");
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [subscribersCount, setSubscribersCount] = useState(0);
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipRefreshKey, setTipRefreshKey] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowPending, setIsFollowPending] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSavePending, setIsSavePending] = useState(false);

  const totalPosts = posts.length;
  const totalLikes = posts.reduce((sum, post) => sum + (post.likes_count || 0), 0);
  const animatedLikes = useCountUp(totalLikes, { duration: 800, decimals: 0 });

  const filteredPosts = useMemo(() => {
    if (selectedFilter === "All") return posts;
    if (selectedFilter === "Photos")
      return posts.filter(
        (p) => !p.media || p.media.length === 0 || p.media[0]?.media_type === "image"
      );
    if (selectedFilter === "Videos")
      return posts.filter((p) => p.media && p.media[0]?.media_type === "video");
    if (selectedFilter === "Exclusive") return posts.filter((p) => p.visibility === "subscribers");
    if (selectedFilter === "Behind the Scenes")
      return posts.filter(
        (p) =>
          p.tags?.includes("behindthescenes") ||
          p.tags?.includes("behind-the-scenes") ||
          p.title?.toLowerCase().includes("behind the scenes")
      );
    if (selectedFilter === "Collab")
      return posts.filter(
        (p) =>
          p.tags?.includes("collab") ||
          p.tags?.includes("collaboration") ||
          p.title?.toLowerCase().includes("collab")
      );
    return posts;
  }, [posts, selectedFilter]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Public profile: guests can view (paywalled posts show the paywall).
        // Do NOT redirect to /auth — only set viewer identity when logged in.
        setCurrentUserId(viewerId);

        if (auth.profile) {
          setCurrentUser({
            username: auth.profile.display_name || "user",
            role: (auth.profile.role || "fan") as "fan" | "creator",
            avatar: auth.profile.avatar_url || undefined,
          });
        }

        // Fetch subscription status + creator profile + follow/save state +
        // posts all in parallel. Posts only need `creatorId` (a route param we
        // already have) — the previous code awaited creatorResponse first and
        // only then fetched posts, adding a full extra network round trip to
        // every profile page load for no reason (see 2026-07-26 audit).
        const [statusResponse, creatorResponse, followResponse, savedResponse, postsResponse] =
          await Promise.all([
            viewerId && viewerId !== creatorId
              ? fetch(`/api/subscription/status?creatorId=${creatorId}`)
              : Promise.resolve(null),
            fetch(`/api/creator/${creatorId}`),
            fetch(`/api/follow?creatorId=${creatorId}`),
            viewerId && viewerId !== creatorId
              ? fetch(`/api/save/creator?creatorId=${creatorId}`)
              : Promise.resolve(null),
            fetch(`/api/creator/${creatorId}/posts`),
          ]);

        if (statusResponse) {
          const statusData = await statusResponse.json();
          setIsSubscribed(statusData.isSubscribed || false);
        }

        if (followResponse && followResponse.ok) {
          const followData = await followResponse.json();
          setFollowersCount(followData.count || 0);
          setIsFollowing(followData.following || false);
        }

        if (savedResponse && savedResponse.ok) {
          const savedData = await savedResponse.json();
          setIsSaved(savedData.saved || false);
        }

        let creator = null;
        if (creatorResponse.ok) {
          const creatorData = await creatorResponse.json();
          creator = creatorData.creator;
        }

        // Fallback to mock data when creator not found in DB (demo mode)
        if (!creator) {
          const mockCreator = MOCK_CREATORS.find(
            (c) => c.id === creatorId || c.username === creatorId
          );
          if (mockCreator) {
            creator = {
              id: mockCreator.id,
              display_name: mockCreator.display_name,
              bio: mockCreator.bio,
              avatar_url: mockCreator.avatar_url,
              subscription_price_cents: 999,
            };
            const mockPostsForCreator = MOCK_POSTS.filter(
              (p) => p.creator_id === mockCreator.id || p.creator_id === creatorId
            ).map((p) => ({
              ...p,
              creator: mockCreator,
            }));
            setPosts(mockPostsForCreator);
            setSubscribersCount(mockCreator.subscriber_count || 0);
            const states = new Map<string, boolean>();
            for (const post of mockPostsForCreator) {
              states.set(post.id, post.visibility === "free");
            }
            setPostViewStates(states);
          } else {
            setError("Creator not found");
            return;
          }
        } else {
          if (postsResponse.ok) {
            const postsData = await postsResponse.json();
            setPosts(postsData.posts || []);
            const states = new Map<string, boolean>();
            for (const post of postsData.posts || []) {
              states.set(post.id, postsData.unlockedStates?.[post.id] || false);
            }
            setPostViewStates(states);
          }
        }

        Analytics.creatorProfileViewed(creatorId);
        // Server-side aggregate view counter (best-effort, fire and forget).
        fetch(`/api/creators/${creatorId}/view`, { method: "POST" }).catch(() => {});
        setCreatorProfile({
          id: creator.id,
          display_name: creator.display_name,
          bio: creator.bio,
          avatar_url: creator.avatar_url,
          is_verified: creator.is_verified ?? false,
          is_founding_creator: creator.is_founding_creator ?? false,
          category: creator.category ?? null,
          external_links: creator.external_links ?? [],
          tags: creator.tags ?? [],
        });
        // Subscription price (cents → dollars); default 9.99 if not set
        if (creator.subscription_price_cents && creator.subscription_price_cents > 0) {
          setSubscriptionPrice(creator.subscription_price_cents / 100);
        }
        setSubscribersCount(creator.subscribers_count || creator.subscriber_count || 0);
      } catch (err) {
        console.error("[creator] loadData error", err);
        setError("Failed to load, please try again");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [creatorId, router, viewerId, auth.profile]);

  const reloadPosts = async () => {
    const postsResponse = await fetch(`/api/creator/${creatorId}/posts`);
    if (postsResponse.ok) {
      const postsData = await postsResponse.json();
      setPosts(postsData.posts || []);
      const states = new Map<string, boolean>();
      for (const post of postsData.posts || []) {
        states.set(post.id, postsData.unlockedStates?.[post.id] || false);
      }
      setPostViewStates(states);
    }
  };

  // Opens the PaywallModal for user to confirm subscription
  const handleSubscribe = () => {
    setShowSubscribeModal(true);
  };

  // Called by PaywallModal.onSuccess after user confirms
  const confirmSubscribe = async () => {
    setIsSubscribing(true);
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId }),
      });
      const data = await response.json();
      if (data.success) {
        setIsSubscribed(true);
        toast.success(`Subscribed to ${creatorProfile?.display_name || "creator"}!`);
        await reloadPosts();
      } else {
        toast.error(data.error || "Subscription failed. Please try again.");
        throw new Error(data.error || "Subscription failed");
      }
    } catch (err) {
      console.error("[creator] subscribe error", err);
      throw err;
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
      if (data.success) {
        setIsSubscribed(false);
        await reloadPosts();
      }
    } catch (err) {
      console.error("[creator] cancelSubscription error", err);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/creator/${creatorId}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ url: shareUrl, title: creatorProfile?.display_name ?? "Creator" });
        return;
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard!");
    } catch {
      window.prompt("Copy this link:", shareUrl);
    }
  };

  const handleReport = () => {
    router.push(`/report?type=creator&id=${creatorId}`);
  };

  const handleToggleFollow = async () => {
    if (!currentUserId) {
      router.push("/auth");
      return;
    }
    try {
      setIsFollowPending(true);
      const res = isFollowing
        ? await fetch(`/api/follow?creatorId=${creatorId}`, { method: "DELETE" })
        : await fetch("/api/follow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creatorId }),
          });
      const data = await res.json();
      if (data.success) {
        setIsFollowing(data.following);
        setFollowersCount((prev) => Math.max(0, prev + (data.following ? 1 : -1)));
        if (data.following) {
          Analytics.track("creator_followed", { creator_id: creatorId });
          toast.success(`Following ${creatorProfile?.display_name || "creator"}`);
        }
      } else {
        toast.error(data.error || "Failed to update follow");
      }
    } catch {
      toast.error("Failed to update follow");
    } finally {
      setIsFollowPending(false);
    }
  };

  const handleToggleSave = async () => {
    if (!currentUserId) {
      router.push("/auth");
      return;
    }
    try {
      setIsSavePending(true);
      const res = isSaved
        ? await fetch(`/api/save/creator?creatorId=${creatorId}`, { method: "DELETE" })
        : await fetch("/api/save/creator", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creatorId }),
          });
      const data = await res.json();
      if (data.success) {
        setIsSaved(data.saved);
        if (data.saved) {
          Analytics.track("creator_saved", { creator_id: creatorId });
          toast.success("Saved to your list");
        }
      } else {
        toast.error(data.error || "Failed to update saved state");
      }
    } catch {
      toast.error("Failed to update saved state");
    } finally {
      setIsSavePending(false);
    }
  };

  const isOwnProfile = currentUserId === creatorId;

  if (isLoading) {
    return (
      <PageShell user={currentUser} notificationCount={0} noPadding>
        <CreatorProfileSkeleton />
      </PageShell>
    );
  }

  if (error || !creatorProfile) {
    return (
      <PageShell user={currentUser} notificationCount={0} maxWidth="2xl">
        <div className="py-8">
          <ErrorState
            title="Creator Not Found"
            message={error || "This creator does not exist"}
            retry={() => {
              setError(null);
              setIsLoading(true);
            }}
            variant="centered"
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell user={currentUser} notificationCount={0} noPadding>
      {/* Mobile-only Fixed Header */}
      <header
        className="fixed top-0 left-0 right-0 glass-strong border-b border-border-subtle md:hidden"
        style={{ zIndex: "var(--z-nav)" as unknown as number }}
      >
        <div className="flex items-center justify-between px-4 h-14 max-w-3xl mx-auto">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.back()}
            aria-label="Go back"
            className="text-text-primary active:scale-[0.98]"
          >
            <ChevronLeft className="w-6 h-6" aria-hidden="true" />
          </Button>
          <span className="font-semibold text-text-primary truncate max-w-[220px] flex items-center gap-1.5 text-body">
            {creatorProfile.display_name || "Creator"}
            {creatorProfile.is_verified && <VerifiedBadge size={15} />}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="More options"
                data-testid="creator-more-btn"
                className="text-text-primary active:scale-[0.98]"
              >
                <MoreVertical className="w-5 h-5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" data-testid="creator-more-menu">
              <DropdownMenuItem data-testid="creator-copy-link" onClick={handleShare}>
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="creator-report" onClick={handleReport}>
                Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Banner */}
      <div className="relative mt-14 md:mt-0 h-40 md:h-52 overflow-hidden">
        <div className="w-full h-full bg-[var(--bg-raised)]" />
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--info)]/40 via-[var(--wine)]/20 to-transparent" />
        {/* Stronger bottom fade to eliminate harsh transition with background */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg-base to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg-base/20 to-bg-base" />
      </div>

      {/* Profile Section */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 pb-40">
        {/* Desktop inline back row */}
        <div className="hidden md:flex items-center gap-3 pt-4 mb-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.back()}
            aria-label="Go back"
            className="text-text-muted hover:text-text-primary active:scale-[0.98]"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </Button>
          <span className="text-small text-text-muted">Back</span>
        </div>
        {/* Avatar + Subscribe Row */}
        <div className="flex items-end justify-between -mt-14 md:-mt-10 mb-4">
          <Avatar className="w-24 h-24 md:w-28 md:h-28 border-4 border-bg-base rounded-full ring-2 ring-white/10 shadow-xl flex-shrink-0">
            <AvatarImage
              src={creatorProfile.avatar_url || DEFAULT_AVATAR_CREATOR}
              alt={creatorProfile.display_name || "Creator"}
              className="object-cover"
            />
            <AvatarFallback className="text-2xl font-bold bg-[var(--wine)]/20 text-wine-text rounded-full">
              {creatorProfile.display_name?.[0]?.toUpperCase() || "C"}
            </AvatarFallback>
          </Avatar>
          {/* PC Follow + Save + Subscribe + Tip buttons */}
          {!isOwnProfile && (
            <div className="hidden md:flex items-center gap-2 pb-1">
              <Button
                variant={isFollowing ? "outline" : "default"}
                size="sm"
                className="rounded-full px-4 gap-1.5 active:scale-[0.98]"
                onClick={handleToggleFollow}
                disabled={isFollowPending}
                data-testid="follow-button"
                aria-label={isFollowing ? "Unfollow this creator" : "Follow this creator for free"}
              >
                <Heart size={13} />
                {isFollowing ? "Following" : "Follow"}
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                className="rounded-full active:scale-[0.98]"
                onClick={handleToggleSave}
                disabled={isSavePending}
                data-testid="save-creator-button"
                aria-label={isSaved ? "Remove from saved" : "Save this creator"}
              >
                <Bookmark size={14} className={isSaved ? "text-[var(--premium)]" : undefined} />
              </Button>
              {WALLET_PATH_ACTIVE && (
                <Button
                  size="sm"
                  className="rounded-full px-4 gap-1.5 active:scale-[0.98]"
                  onClick={() => setShowTipModal(true)}
                  aria-label="Send a tip"
                >
                  <DollarSign size={13} />
                  Tip
                </Button>
              )}
              {isSubscribed ? (
                <Button
                  variant="outline"
                  onClick={handleCancelSubscription}
                  disabled={isSubscribing}
                  className="rounded-full px-5 active:scale-[0.98]"
                >
                  {isSubscribing ? (
                    "…"
                  ) : (
                    <>
                      <CheckCircle2 size={14} className="mr-1.5" aria-hidden="true" />
                      Subscribed
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleSubscribe}
                  disabled={isSubscribing}
                  className="rounded-full px-5 gap-1.5 active:scale-[0.98]"
                  data-testid="subscribe-button"
                  aria-label="Subscribe to this creator"
                >
                  <Plus size={14} />
                  {WALLET_PATH_ACTIVE
                    ? `Subscribe for ${formatUsd(Math.round(subscriptionPrice * 100))}/month`
                    : "View Options"}
                </Button>
              )}
            </div>
          )}
          {isOwnProfile && (
            <Button
              variant="outline"
              size="sm"
              className="hidden md:flex rounded-full px-5"
              onClick={() => router.push("/me")}
            >
              Edit Profile
            </Button>
          )}
        </div>

        {/* Creator Info */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h1 className="text-h2 font-bold text-text-primary leading-tight">
              {creatorProfile.display_name || "Creator"}
            </h1>
            {creatorProfile.is_verified && <VerifiedBadge size={18} />}
            {creatorProfile.is_founding_creator && <FoundingCreatorBadge size={12} withLabel />}
          </div>
          <p className="text-small text-text-muted mb-3">
            @{(creatorProfile.display_name || "creator").replace(/\s+/g, "").toLowerCase()}
            {creatorProfile.category && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-surface-raised border border-border-subtle text-tiny text-text-secondary">
                {creatorProfile.category}
              </span>
            )}
          </p>

          {/* Inline Stats */}
          <div className="flex items-center gap-4 text-small mb-3 flex-wrap">
            <span>
              <strong className="text-text-primary font-bold">{totalPosts}</strong>{" "}
              <span className="text-text-muted">posts</span>
            </span>
            <span data-testid="followers-count">
              <strong className="text-text-primary font-bold">
                {formatCountCompact(followersCount)}
              </strong>{" "}
              <span className="text-text-muted">followers</span>
            </span>
            <span>
              <strong className="text-text-primary font-bold">
                {formatCountCompact(subscribersCount)}
              </strong>{" "}
              <span className="text-text-muted">subscribers</span>
            </span>
            <span>
              <strong className="text-text-primary font-bold">
                {formatCountCompact(Math.round(animatedLikes))}
              </strong>{" "}
              <span className="text-text-muted">likes</span>
            </span>
          </div>

          {/* Bio */}
          {creatorProfile.bio && (
            <p className="text-small text-text-secondary leading-relaxed mb-4">
              {creatorProfile.bio}
            </p>
          )}

          {/* Creator Tags */}
          {creatorProfile.tags && creatorProfile.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-4">
              {creatorProfile.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full bg-[var(--wine)]/10 text-wine-text text-tiny font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Official External Links (admin-approved) */}
          {creatorProfile.external_links && creatorProfile.external_links.length > 0 && (
            <div className="mb-4" data-testid="creator-external-links">
              <div className="flex items-center gap-2 flex-wrap">
                {creatorProfile.external_links.map((link) => (
                  <a
                    key={link.id}
                    href={`/api/link/out?id=${link.id}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    onClick={() =>
                      Analytics.track("external_link_clicked", {
                        creator_id: creatorId,
                        link_id: link.id,
                        label: link.label,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-raised border border-border-default text-tiny font-medium text-text-secondary hover:text-text-primary hover:border-[var(--wine)]/40 transition-colors"
                  >
                    <ExternalLink size={12} />
                    {link.label}
                  </a>
                ))}
              </div>
              <p className="text-tiny text-text-quaternary mt-1.5">
                Verified external links. Purchases made on external sites are not handled by
                GetFanSee.
              </p>
            </div>
          )}

          {/* Mobile: Follow + Save + Share + Tip — Subscribe is in the sticky bottom bar */}
          {!isOwnProfile && (
            <div className="flex md:hidden gap-3 mt-1">
              <Button
                variant={isFollowing ? "outline" : "default"}
                size="sm"
                className="rounded-full px-4 gap-1.5 flex-1"
                onClick={handleToggleFollow}
                disabled={isFollowPending}
                data-testid="follow-button-mobile"
                aria-label={isFollowing ? "Unfollow this creator" : "Follow this creator for free"}
              >
                <Heart size={13} />
                {isFollowing ? "Following" : "Follow"}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleToggleSave}
                disabled={isSavePending}
                className="rounded-full"
                aria-label={isSaved ? "Remove from saved" : "Save this creator"}
              >
                <Bookmark size={16} className={isSaved ? "text-[var(--premium)]" : undefined} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleShare}
                className="rounded-full"
                aria-label="Share profile"
                data-testid="creator-share-btn"
              >
                <Share2 size={18} />
              </Button>
              {WALLET_PATH_ACTIVE && (
                <Button
                  size="sm"
                  className="rounded-full px-4 gap-1.5"
                  onClick={() => setShowTipModal(true)}
                  aria-label="Send a tip"
                >
                  <DollarSign size={13} />
                  Tip
                </Button>
              )}
            </div>
          )}
          {isOwnProfile && (
            <Button
              variant="outline"
              className="md:hidden w-full rounded-full"
              onClick={() => router.push("/me")}
            >
              Edit Profile
            </Button>
          )}
        </div>

        {/* Support / Buy-me-a-coffee block — wallet-based tipping only */}
        {!isOwnProfile && WALLET_PATH_ACTIVE && (
          <div className="mb-5">
            <SupportBlock
              creatorId={creatorId}
              creatorName={creatorProfile.display_name ?? undefined}
              onTip={() => setShowTipModal(true)}
              refreshKey={tipRefreshKey}
            />
          </div>
        )}

        {/* Guest email capture — signed-out visitors can still get updates */}
        {!currentUserId && (
          <NewsletterSignup
            source="creator_profile"
            title={`Get notified when ${creatorProfile.display_name || "this creator"} posts`}
            description="Leave your email and we'll let you know about new posts. No spam."
            className="mb-5"
          />
        )}

        {/* Tabs: Posts | About */}
        <div className="flex border-b border-border-subtle mb-0" role="tablist">
          {(["posts", "about"] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "min-h-11 flex items-center px-4 text-small font-semibold relative transition-colors capitalize",
                "focus-visible:outline-2 focus-visible:outline-[var(--wine)] focus-visible:outline-offset-1",
                activeTab === tab
                  ? "text-text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[var(--wine)] after:rounded-full"
                  : "text-text-muted hover:text-text-primary"
              )}
            >
              {tab === "posts" ? "Posts" : "About"}
            </button>
          ))}
        </div>

        {/* Posts Tab */}
        {activeTab === "posts" && (
          <div className="min-h-[400px]">
            {/* Content Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto py-3 mb-3 scrollbar-none -mx-4 px-4">
              {CONTENT_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setSelectedFilter(f)}
                  className={cn(
                    "shrink-0 min-h-11 px-3.5 rounded-full border text-tiny font-medium transition-[background-color,color,border-color]",
                    "focus-visible:outline-2 focus-visible:outline-[var(--wine)]",
                    selectedFilter === f
                      ? "bg-[var(--wine)] text-text-primary border-transparent"
                      : "bg-surface-raised border-border-subtle text-text-muted hover:border-[var(--wine)]/30 hover:text-text-primary"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* 3-Col Post Grid */}
            {filteredPosts.length === 0 ? (
              <div className="py-16 text-center">
                <FileText className="w-10 h-10 mx-auto mb-3 text-text-quaternary" />
                <p className="text-small text-text-muted">No posts yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-0.5 md:gap-1">
                {filteredPosts.map((post) => (
                  <PostGridItem
                    key={post.id}
                    post={post}
                    isUnlocked={postViewStates.get(post.id) === true}
                    currentUserId={currentUserId}
                    onUnlock={() => {
                      if (post.visibility === "ppv" && post.price_cents) {
                        setSelectedPpvPost({
                          id: post.id,
                          price: post.price_cents / 100,
                          title: post.title || undefined,
                        });
                        setShowPpvModal(true);
                      } else {
                        setShowSubscribeModal(true);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* About Tab */}
        {activeTab === "about" && (
          <div className="pt-4 pb-8 space-y-4 min-h-[400px]">
            <div className="glass-card rounded-[var(--radius-md)] p-5">
              <h3 className="text-h4 text-text-primary mb-3 flex items-center gap-2">
                <Star size={14} className="text-wine-text" />
                About
              </h3>
              {creatorProfile.bio ? (
                <p className="text-small text-text-secondary leading-relaxed">
                  {creatorProfile.bio}
                </p>
              ) : (
                <p className="text-small text-text-muted">No bio yet.</p>
              )}
            </div>
            <div className="glass-card rounded-[var(--radius-md)] p-5">
              <div className="flex items-center gap-3">
                <Users size={16} className="text-wine-text" />
                <p className="text-small text-text-secondary">
                  <strong className="text-text-primary">
                    {formatCountCompact(subscribersCount)}
                  </strong>{" "}
                  subscribers supporting this creator
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Floating Subscribe */}
      {!isOwnProfile && (
        <div
          className="md:hidden fixed bottom-14 left-0 right-0 p-3 bg-bg-base/95 backdrop-blur-sm border-t border-border-subtle"
          style={{ zIndex: "var(--z-sticky)" as unknown as number }}
        >
          {isSubscribed ? (
            <Button
              variant="outline"
              onClick={handleCancelSubscription}
              disabled={isSubscribing}
              className="w-full rounded-xl min-h-[52px] active:scale-[0.98]"
            >
              {isSubscribing ? "Processing…" : "Unsubscribe"}
            </Button>
          ) : (
            <Button
              onClick={handleSubscribe}
              disabled={isSubscribing}
              className="w-full rounded-xl min-h-[52px] font-bold active:scale-[0.98]"
              data-testid="subscribe-button"
              aria-label="Subscribe to this creator"
            >
              {isSubscribing
                ? "Processing…"
                : WALLET_PATH_ACTIVE
                  ? `Subscribe for ${formatUsd(Math.round(subscriptionPrice * 100))}/mo`
                  : "View Options"}
            </Button>
          )}
        </div>
      )}

      {/* Subscribe PaywallModal */}
      {!isOwnProfile && creatorProfile && (
        <PaywallModal
          open={showSubscribeModal}
          onOpenChange={setShowSubscribeModal}
          type="subscribe"
          creatorName={creatorProfile.display_name || "Creator"}
          creatorAvatar={creatorProfile.avatar_url}
          price={subscriptionPrice}
          billingPeriod="month"
          benefits={[
            "Full access to all exclusive posts",
            "Direct messaging with creator",
            "Early access to new content",
            "Member-only live streams",
            "Cancel anytime",
          ]}
          creatorId={creatorId}
          onSuccess={confirmSubscribe}
        />
      )}

      {/* PPV Unlock PaywallModal */}
      {!isOwnProfile && creatorProfile && selectedPpvPost && (
        <PaywallModal
          open={showPpvModal}
          onOpenChange={(open) => {
            setShowPpvModal(open);
            if (!open) setSelectedPpvPost(null);
          }}
          type="ppv"
          creatorName={creatorProfile.display_name || "Creator"}
          creatorAvatar={creatorProfile.avatar_url}
          price={selectedPpvPost.price}
          benefits={[
            selectedPpvPost.title || "Exclusive content",
            "Permanent access after purchase",
            "High-quality media",
          ]}
          postId={selectedPpvPost.id}
          creatorId={creatorId}
          onSuccess={async () => {
            setPostViewStates((prev) => {
              const next = new Map(prev);
              next.set(selectedPpvPost.id, true);
              return next;
            });
          }}
        />
      )}

      {/* Tip Modal */}
      {!isOwnProfile && creatorProfile && (
        <TipModal
          open={showTipModal}
          onOpenChange={setShowTipModal}
          creatorId={creatorId}
          creatorName={creatorProfile.display_name ?? undefined}
          onSuccess={() => setTipRefreshKey((k) => k + 1)}
        />
      )}
    </PageShell>
  );
}
