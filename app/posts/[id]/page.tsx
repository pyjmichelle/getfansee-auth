"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PostLikeButton } from "@/components/post-like-button";
import { CommentList } from "@/components/comments/comment-list";
import { MediaDisplay } from "@/components/media-display";
import { PaywallModal } from "@/components/paywall-modal";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { BottomNavigation } from "@/components/bottom-navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { type Post } from "@/lib/types";
import Link from "next/link";
import { ArrowLeft, Share2, Lock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const supabase = getSupabaseBrowserClient();

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

        // 加载帖子详情
        const response = await fetch(`/api/posts/${postId}`);
        if (!response.ok) {
          throw new Error("Failed to load post");
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || "Failed to load post");
        }

        setPost(data.post);

        // 检查查看权限
        const isCreator = data.post.creator_id === session.user.id;
        const isFree = data.post.visibility === "free";
        const isUnlocked = data.canView || false;

        setCanView(isCreator || isFree || isUnlocked);
      } catch (err: unknown) {
        console.error("[PostDetail] loadData error:", err);
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
      navigator.share({
        title: post?.title || "Check out this post",
        url: url,
      });
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
      <div className="min-h-screen bg-background pb-20" data-testid="post-detail-page">
        <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border-base">
          <div className="flex items-center justify-center px-4 h-14">
            <h1 className="font-semibold text-text-primary">Post</h1>
          </div>
        </header>
        <main className="pt-14 flex items-center justify-center min-h-[50vh]">
          <LoadingState type="spinner" text="Loading post…" />
        </main>
        <BottomNavigation notificationCount={0} userRole={currentUser?.role} />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background pb-20" data-testid="post-page-error">
        <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border-base">
          <div className="flex items-center px-4 h-14">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => router.back()}
              aria-label="Go back"
              className="text-text-primary"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </Button>
          </div>
        </header>
        <main className="pt-14 px-4">
          <ErrorState
            title="Failed to load post"
            message={error || "Post not found"}
            retry={() => window.location.reload()}
            variant="centered"
          />
        </main>
        <BottomNavigation notificationCount={0} userRole={currentUser?.role} />
      </div>
    );
  }

  const isCreator = currentUser?.id === post.creator_id;

  return (
    <div className="min-h-screen bg-background pb-20" data-testid="page-ready">
      {/* Fixed Header - Figma Style */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border-base">
        <div className="flex items-center justify-between px-4 h-14">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.back()}
            aria-label="Go back"
            className="text-text-primary"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Button>
          <h1 className="font-semibold text-text-primary">Post</h1>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleShare}
            aria-label="Share this post"
            className="text-text-primary"
          >
            <Share2 className="w-5 h-5" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {/* Main Content - Figma Layout */}
      <main className="pt-14 max-w-2xl mx-auto px-4 md:px-6">
        {/* Creator Info */}
        <div className="py-3 flex items-center gap-3 border-b border-border-base">
          <Link href={`/creator/${post.creator_id}`}>
            <Avatar className="w-10 h-10 cursor-pointer hover:opacity-80 transition-opacity ring-2 ring-transparent hover:ring-brand-primary/30">
              <AvatarImage
                src={post.creator?.avatar_url || "/placeholder.svg"}
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

        {/* Post Content */}
        <div className="py-3">
          {post.title && (
            <h2
              className="text-xl font-bold text-text-primary mb-2 leading-tight"
              data-testid="post-title"
            >
              {post.title}
            </h2>
          )}
          {post.content && (
            <p
              className="text-text-secondary text-sm whitespace-pre-wrap leading-relaxed"
              data-testid="post-content"
            >
              {post.content}
            </p>
          )}
        </div>

        {/* Media Display - Full Width */}
        <div className="bg-black" data-testid="post-media">
          <MediaDisplay
            post={post}
            canView={canView || isCreator}
            isCreator={isCreator}
            onSubscribe={() => {
              toast.info("Subscription feature is coming soon");
            }}
            onUnlock={() => {
              toast.info("Unlock feature is coming soon");
            }}
            creatorDisplayName={post.creator?.display_name}
          />
        </div>

        {/* Locked State */}
        {!canView && !isCreator && (
          <div
            className="px-6 py-8 text-center bg-gradient-to-b from-black/5 to-black/10"
            data-testid="post-locked-overlay"
          >
            <div className="w-16 h-16 mx-auto mb-4 bg-brand-primary/20 backdrop-blur-md rounded-full flex items-center justify-center border border-brand-primary/30 shadow-glow">
              <Lock size={28} className="text-brand-primary" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-text-primary">Premium Content</h3>
            <p className="text-sm text-text-tertiary mb-6 max-w-sm mx-auto">
              {post.visibility === "subscribers"
                ? "This exclusive content is available for subscribers only"
                : `Unlock this hot content for $${((post.price_cents || 0) / 100).toFixed(2)}`}
            </p>
            <Button
              variant={post.visibility === "subscribers" ? "subscribe-gradient" : "unlock-gradient"}
              size="lg"
              className="px-8 py-4 text-lg font-bold rounded-xl"
              data-testid={
                post.visibility === "subscribers" ? "post-subscribe-button" : "post-unlock-button"
              }
              onClick={() => setShowPaywallModal(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setShowPaywallModal(true);
                }
              }}
              aria-label={
                post.visibility === "subscribers"
                  ? "Subscribe to unlock this content"
                  : `Unlock this content for $${((post.price_cents || 0) / 100).toFixed(2)}`
              }
            >
              <Lock size={20} className="mr-2" />
              {post.visibility === "subscribers" ? "Subscribe to Unlock" : "Unlock Now"}
            </Button>
          </div>
        )}

        {/* Post Actions */}
        <div className="py-3 flex items-center gap-2 border-t border-border-base">
          <PostLikeButton
            postId={post.id}
            initialLikesCount={post.likes_count || 0}
            userId={currentUser?.id}
          />
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-text-tertiary hover:text-brand-primary hover:bg-brand-primary/5"
            onClick={handleShare}
            aria-label="Share this post"
          >
            <Share2 className="w-5 h-5" aria-hidden="true" />
            <span className="hidden sm:inline">Share</span>
          </Button>

          {/* Tip Button */}
          <Button
            variant="tip-gradient"
            size="sm"
            className="ml-auto gap-1.5 rounded-full px-4"
            onClick={() => toast.info("Tip feature coming soon!")}
          >
            <span className="hidden sm:inline">Send Tip</span>
            <span className="sm:hidden">Tip</span>
          </Button>
        </div>

        {/* Comments Section */}
        {currentUser && (
          <div className="border-t border-border-base divide-y divide-border-base">
            <CommentList
              postId={postId}
              currentUserId={currentUser.id}
              canComment={canView || isCreator}
            />
          </div>
        )}
      </main>

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

      <BottomNavigation notificationCount={0} />
    </div>
  );
}
