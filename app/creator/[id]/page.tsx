"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { PostCard } from "@/components/post-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { type Post } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Image as ImageIcon,
  Heart,
  FileText,
  Lock,
  Share2,
  ChevronLeft,
  Users,
  Grid3X3,
  Star,
} from "@/lib/icons";
import { ReportButton } from "@/components/report-button";
import { PaywallModal } from "@/components/paywall-modal";
import { toast } from "sonner";
import { Analytics } from "@/lib/analytics";
import { ErrorState } from "@/components/error-state";
import { DEFAULT_AVATAR_CREATOR } from "@/lib/image-fallbacks";
import { useCountUp } from "@/hooks/use-count-up";

const supabase = getSupabaseBrowserClient();

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
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [subscriptionPrice, setSubscriptionPrice] = useState(9.99);
  const [postViewStates, setPostViewStates] = useState<Map<string, boolean>>(new Map());
  const [activeTab, setActiveTab] = useState<"posts" | "media" | "likes">("posts");

  const totalPosts = posts.length;
  const mediaPosts = posts.filter(
    (post) => (post.media && post.media.length > 0) || post.media_url
  ).length;
  const totalLikes = posts.reduce((sum, post) => sum + (post.likes_count || 0), 0);
  const animatedLikes = useCountUp(totalLikes, { duration: 800, decimals: 0 });

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/auth");
          return;
        }

        await fetch("/api/auth/ensure-profile", { method: "POST" });
        setCurrentUserId(session.user.id);

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

        if (session.user.id !== creatorId) {
          const statusResponse = await fetch(`/api/subscription/status?creatorId=${creatorId}`);
          const statusData = await statusResponse.json();
          setIsSubscribed(statusData.isSubscribed || false);
        }

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

        Analytics.creatorProfileViewed(creatorId);
        setCreatorProfile({
          id: creator.id,
          display_name: creator.display_name,
          bio: creator.bio,
          avatar_url: creator.avatar_url,
        });
        // Subscription price (cents → dollars); default 9.99 if not set
        if (creator.subscription_price_cents && creator.subscription_price_cents > 0) {
          setSubscriptionPrice(creator.subscription_price_cents / 100);
        }

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
      } catch (err) {
        console.error("[creator] loadData error", err);
        setError("Failed to load, please try again");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [creatorId, router]);

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
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.success("Link copied!");
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
            retry={() => router.push("/home")}
            variant="centered"
          />
        </div>
      </PageShell>
    );
  }

  const tabs = [
    { id: "posts" as const, label: "Posts", icon: FileText, count: totalPosts },
    { id: "media" as const, label: "Media", icon: ImageIcon, count: mediaPosts },
    { id: "likes" as const, label: "Likes", icon: Heart },
  ];

  return (
    <PageShell user={currentUser} notificationCount={0} noPadding>
      {/* Fixed Header - creator profile has its own custom header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border-base">
        <div className="flex items-center justify-between px-4 h-14 max-w-6xl mx-auto">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.back()}
            aria-label="Go back"
            className="text-text-primary active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
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
            className="text-text-primary active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <Share2 className="w-5 h-5" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {/* Banner */}
      <div className="relative mt-14 h-48 md:h-64 duotone-overlay overflow-hidden">
        <div className="w-full h-full bg-gradient-primary opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/60" />
      </div>

      {/* Two-Column Layout: Avatar Section + (Desktop) Sidebar */}
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        {/* Avatar + Name Row */}
        <div className="relative -mt-14 md:-mt-16 mb-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="flex items-end gap-4">
              <Avatar className="w-24 h-24 md:w-28 md:h-28 border-4 border-background ring-2 ring-brand-primary/30 shadow-glow rounded-2xl flex-shrink-0">
                <AvatarImage
                  src={creatorProfile.avatar_url || DEFAULT_AVATAR_CREATOR}
                  alt={creatorProfile.display_name || "Creator"}
                  className="object-cover"
                />
                <AvatarFallback className="text-2xl md:text-3xl bg-brand-primary-alpha-10 text-brand-primary font-bold rounded-2xl">
                  {creatorProfile.display_name?.[0]?.toUpperCase() || "C"}
                </AvatarFallback>
              </Avatar>
              <div className="pb-2">
                <h1 className="text-xl md:text-2xl font-bold text-text-primary mb-1">
                  {creatorProfile.display_name || "Creator"}
                </h1>
                {creatorProfile.bio && (
                  <p className="text-text-tertiary text-sm max-w-md line-clamp-2">
                    {creatorProfile.bio}
                  </p>
                )}
              </div>
            </div>

            {/* Desktop CTA */}
            {!isOwnProfile && (
              <div className="hidden md:flex flex-col items-end gap-2">
                {isSubscribed ? (
                  <Button
                    variant="outline"
                    onClick={handleCancelSubscription}
                    disabled={isSubscribing}
                    className="rounded-xl min-w-[160px] active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
                  >
                    {isSubscribing ? "..." : "Subscribed"}
                  </Button>
                ) : (
                  <Button
                    variant="subscribe-gradient"
                    onClick={handleSubscribe}
                    disabled={isSubscribing}
                    className="rounded-xl min-w-[160px] hover-bold shadow-glow active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
                    data-testid="subscribe-button"
                    aria-label="Subscribe to this creator"
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

        {/* PC: Two-column — stats left, content right */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* LEFT / TOP: Stats + About Sidebar */}
          <aside className="w-full lg:w-72 shrink-0 space-y-4">
            {/* Bento Stats */}
            <div className="grid grid-cols-3 lg:grid-cols-1 gap-3">
              <div className="card-block p-4 flex lg:flex-row lg:items-center lg:justify-between flex-col text-center lg:text-left">
                <div>
                  <p className="text-xs text-text-tertiary mb-0.5">Posts</p>
                  <p className="text-2xl font-bold text-text-primary">{totalPosts}</p>
                </div>
                <FileText
                  className="w-5 h-5 text-brand-primary/50 hidden lg:block"
                  aria-hidden="true"
                />
              </div>
              <div className="card-block p-4 flex lg:flex-row lg:items-center lg:justify-between flex-col text-center lg:text-left">
                <div>
                  <p className="text-xs text-text-tertiary mb-0.5">Media</p>
                  <p className="text-2xl font-bold text-text-primary">{mediaPosts}</p>
                </div>
                <ImageIcon
                  className="w-5 h-5 text-brand-primary/50 hidden lg:block"
                  aria-hidden="true"
                />
              </div>
              <div className="card-block p-4 flex lg:flex-row lg:items-center lg:justify-between flex-col text-center lg:text-left">
                <div>
                  <p className="text-xs text-text-tertiary mb-0.5">Likes</p>
                  <p className="text-2xl font-bold text-text-primary">{animatedLikes.toFixed(0)}</p>
                </div>
                <Heart className="w-5 h-5 text-error/50 hidden lg:block" aria-hidden="true" />
              </div>
            </div>

            {/* About (Desktop only) */}
            {creatorProfile.bio && (
              <div className="card-block p-4 hidden lg:block">
                <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
                  <Star className="w-4 h-4 text-brand-primary" />
                  About
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">{creatorProfile.bio}</p>
              </div>
            )}

            {/* Social Proof (Desktop) */}
            <div className="card-block p-4 bg-gradient-subtle hidden lg:block">
              <p className="text-sm text-text-secondary">
                <span className="font-bold text-brand-primary">
                  <Users className="w-4 h-4 inline mr-1" />
                  Join thousands
                </span>{" "}
                of fans supporting this creator.
              </p>
            </div>
          </aside>

          {/* RIGHT / MAIN: Tabs + Content */}
          <section className="flex-1 min-w-0">
            {/* Tabs */}
            <div className="flex border-b border-border-base mb-4" role="tablist">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex-1 pb-3 text-sm font-medium transition-colors relative flex items-center justify-center gap-1.5",
                      "active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-brand-primary",
                      activeTab === tab.id
                        ? "text-brand-primary"
                        : "text-text-tertiary hover:text-text-primary"
                    )}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className="text-xs text-text-tertiary">({tab.count})</span>
                    )}
                    {activeTab === tab.id && (
                      <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-brand-primary rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Posts Tab */}
            {activeTab === "posts" && (
              <div className="space-y-4 pb-24 lg:pb-8">
                {posts.length === 0 ? (
                  <div className="card-block p-12 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-text-quaternary" />
                    <p className="text-text-tertiary">No posts yet</p>
                  </div>
                ) : (
                  posts.map((post, index) => {
                    const isUnlocked =
                      postViewStates.get(post.id) === true || post.creator_id === currentUserId;

                    return (
                      <PostCard
                        key={post.id}
                        variant="feed"
                        post={post}
                        currentUserId={currentUserId}
                        isUnlocked={isUnlocked}
                        isSubscribing={isSubscribing}
                        onSubscribe={handleSubscribe}
                        onUnlock={async () => {
                          const res = await fetch("/api/unlock", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              postId: post.id,
                              priceCents: post.price_cents || 0,
                            }),
                          });
                          const result = await res.json();
                          if (result.success) await reloadPosts();
                        }}
                        animationDelay={index < 10 ? index * 60 : undefined}
                      />
                    );
                  })
                )}
              </div>
            )}

            {/* Media Tab */}
            {activeTab === "media" && (
              <div className="pb-24 lg:pb-8">
                {mediaPosts === 0 ? (
                  <div className="card-block p-12 text-center">
                    <ImageIcon
                      className="w-12 h-12 mx-auto mb-3 text-text-quaternary"
                      aria-hidden="true"
                    />
                    <p className="text-text-tertiary">No media posts yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {posts
                      .filter((p) => (p.media && p.media.length > 0) || p.media_url)
                      .map((post) => (
                        <Link
                          key={post.id}
                          href={`/posts/${post.id}`}
                          className="aspect-square bg-surface-raised rounded-xl overflow-hidden relative group hover:ring-2 hover:ring-brand-primary/30 transition-all focus-visible:ring-2 focus-visible:ring-brand-primary"
                        >
                          <div className="w-full h-full flex items-center justify-center">
                            <Grid3X3 className="w-8 h-8 text-text-tertiary group-hover:text-brand-primary transition-colors" />
                          </div>
                          {post.visibility !== "free" && (
                            <div className="absolute top-1 right-1 bg-black/60 rounded-full p-1">
                              <Lock className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </Link>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Likes Tab */}
            {activeTab === "likes" && (
              <div className="card-block p-12 text-center pb-24 lg:pb-8">
                <Heart className="w-12 h-12 mx-auto mb-3 text-text-quaternary" aria-hidden="true" />
                <p className="text-text-tertiary">Liked posts coming soon</p>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Mobile: Floating Subscribe Button */}
      {!isOwnProfile && (
        <div className="md:hidden fixed bottom-14 left-0 right-0 p-3 bg-bg-base/95 backdrop-blur-sm border-t border-border-base z-[45] shadow-lg">
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
              variant="subscribe-gradient"
              className="w-full rounded-xl min-h-[52px] font-bold shadow-glow hover-bold active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand-primary"
              data-testid="subscribe-button"
              aria-label="Subscribe to this creator"
            >
              {isSubscribing ? "Processing…" : "Subscribe Now"}
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
    </PageShell>
  );
}
