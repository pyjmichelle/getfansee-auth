"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PostLikeButton } from "@/components/post-like-button";
import { CommentList } from "@/components/comments/comment-list";
import { MediaDisplay } from "@/components/media-display";
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-16 md:pb-0" data-testid="post-detail-page">
        {currentUser && <NavHeader user={currentUser} notificationCount={0} />}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingState type="spinner" text="Loading post…" />
        </main>
        <BottomNavigation notificationCount={0} userRole={currentUser?.role} />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background pb-16 md:pb-0">
        {currentUser && <NavHeader user={currentUser} notificationCount={0} />}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
    <div className="min-h-screen bg-background">
      {currentUser && <NavHeader user={currentUser} notificationCount={0} />}

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* 返回按钮 */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 -ml-2 rounded-lg min-h-[40px]"
          onClick={() => router.back()}
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
          Back
        </Button>

        <Card className="rounded-xl border shadow-sm mb-6">
          <CardContent className="p-6 sm:p-8">
            {/* Creator Header */}
            <div className="flex items-center gap-4 mb-6 pb-6 border-b">
              <Link href={`/creator/${post.creator_id}`}>
                <Avatar className="w-14 h-14 cursor-pointer hover:opacity-80 transition-opacity ring-2 ring-background">
                  <AvatarImage
                    src={post.creator?.avatar_url || "/placeholder.svg"}
                    alt={post.creator?.display_name || "Creator"}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg">
                    {post.creator?.display_name?.[0]?.toUpperCase() || "C"}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/creator/${post.creator_id}`}>
                  <h3 className="font-semibold text-foreground hover:text-primary transition-colors text-base">
                    {post.creator?.display_name || "Creator"}
                  </h3>
                </Link>
                <p className="text-sm text-muted-foreground">
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
            {post.title && (
              <h1 className="text-3xl font-bold text-foreground mb-4 leading-tight">
                {post.title}
              </h1>
            )}
            <p
              className="text-foreground mb-6 whitespace-pre-wrap text-base leading-relaxed"
              data-testid="post-content"
            >
              {post.content}
            </p>

            {/* Media Display */}
            <div className="mb-6">
              <MediaDisplay
                post={post}
                canView={canView || isCreator}
                isCreator={isCreator}
                onSubscribe={() => {
                  // 订阅逻辑
                  toast.info("Subscription feature is coming soon");
                }}
                onUnlock={() => {
                  // 解锁逻辑
                  toast.info("Unlock feature is coming soon");
                }}
                creatorDisplayName={post.creator?.display_name}
              />
            </div>

            {/* Locked State */}
            {!canView && !isCreator && (
              <div
                className="p-8 bg-muted/50 rounded-xl border border-border text-center"
                data-testid="post-locked-overlay"
              >
                <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
                <h3 className="text-lg font-semibold mb-2">Premium Content</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  {post.visibility === "subscribers"
                    ? "This exclusive content is available for subscribers only"
                    : `Unlock this hot content for $${((post.price_cents || 0) / 100).toFixed(2)}`}
                </p>
                <Button
                  variant={
                    post.visibility === "subscribers" ? "subscribe-gradient" : "unlock-gradient"
                  }
                  className="rounded-xl min-h-[48px] px-8 font-bold shadow-lg"
                  data-testid={
                    post.visibility === "subscribers"
                      ? "post-subscribe-button"
                      : "post-unlock-button"
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      // Handle unlock/subscribe
                    }
                  }}
                  aria-label={
                    post.visibility === "subscribers"
                      ? "Subscribe to unlock this content"
                      : `Unlock this content for $${((post.price_cents || 0) / 100).toFixed(2)}`
                  }
                >
                  {post.visibility === "subscribers" ? "Subscribe to Unlock" : "Unlock Now"}
                </Button>
              </div>
            )}

            {/* Post Actions */}
            <div className="flex items-center gap-4 pt-6 border-t border-border">
              <PostLikeButton
                postId={post.id}
                initialLikesCount={post.likes_count || 0}
                userId={currentUser?.id}
              />
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 hover:bg-accent rounded-lg min-h-[40px]"
                onClick={handleShare}
                aria-label="Share this post"
              >
                <Share2 className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Comments Section */}
        {currentUser && (
          <CommentList
            postId={postId}
            currentUserId={currentUser.id}
            canComment={canView || isCreator}
          />
        )}
      </main>

      <BottomNavigation notificationCount={0} />
    </div>
  );
}
