"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
// listFeed 通过 API 调用，不直接导入
import { Trash2, Eye, Calendar } from "@/lib/icons";
import { Analytics } from "@/lib/analytics";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import type { Post } from "@/lib/types";
import { DEFAULT_AVATAR_CREATOR } from "@/lib/image-fallbacks";
import { getAuthBootstrap } from "@/lib/auth-bootstrap-client";
import { useSkeletonMetric } from "@/hooks/use-skeleton-metric";

export default function ContentReviewPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [deletionReason, setDeletionReason] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useSkeletonMetric("admin_content_review_page", isLoading);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        const bootstrap = await getAuthBootstrap();
        if (!bootstrap.authenticated || !bootstrap.user) {
          router.push("/auth");
          return;
        }
        if (bootstrap.profile?.role !== "admin") {
          router.push("/home");
          return;
        }
        setCurrentUserId(bootstrap.user.id);
        setCurrentUser({
          username:
            bootstrap.profile?.display_name || bootstrap.user.email.split("@")[0] || "admin",
          role: "fan",
          avatar: bootstrap.profile?.avatar_url || undefined,
        });

        // 加载最近发布的内容（最近 50 条，通过 API）
        const response = await fetch("/api/admin/content-review?status=pending");
        if (response.ok) {
          const data = await response.json();
          setPosts(data.posts || []);
        } else {
          console.error("[admin-content-review] Failed to fetch posts");
        }
      } catch (err) {
        console.error("[admin-content-review] loadData error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router]);

  const handleDelete = async (postId: string) => {
    try {
      if (!currentUserId) {
        toast.error("Please log in first");
        return;
      }

      const response = await fetch("/api/admin/content-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          action: "remove",
          reason: deletionReason.trim() || undefined,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        console.error("[admin-content-review] remove error:", payload);
        toast.error("Delete failed. Please try again");
        return;
      }

      Analytics.adminContentRemoved(postId, deletionReason.trim() || undefined);
      toast.success("Content deleted");
      // 重新加载列表（通过 API）
      const refreshResponse = await fetch("/api/admin/content-review?status=pending");
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setPosts(data.posts || []);
      }
      setDeletingPostId(null);
      setDeletionReason("");
    } catch (err) {
      console.error("[admin-content-review] delete exception:", err);
      toast.error("Delete failed. Please try again");
    }
  };

  const getVisibilityBadge = (visibility: string, priceCents: number | null) => {
    if (visibility === "free") {
      return (
        <Badge className="bg-success/10 text-success border-success/20 rounded-lg">Free</Badge>
      );
    } else if (visibility === "subscribers") {
      return (
        <Badge className="bg-brand-primary-alpha-10 text-brand-primary border-brand-primary/20 rounded-lg">
          Subscribers
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-brand-accent/10 text-brand-accent border-brand-accent/20 rounded-lg">
          PPV ${((priceCents || 0) / 100).toFixed(2)}
        </Badge>
      );
    }
  };

  if (isLoading) {
    return (
      <PageShell user={currentUser}>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-surface-raised rounded-2xl"></div>
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell user={currentUser}>
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Content Review</h1>
          <p className="text-text-tertiary">Review and moderate recently published content</p>
        </div>
        <div className="bento-grid mb-6">
          <div className="bento-2x1 card-block p-5">
            <p className="text-sm text-text-tertiary">Total Items</p>
            <p className="text-3xl font-bold text-text-primary">{posts.length}</p>
          </div>
          <div className="card-block p-5">
            <p className="text-sm text-text-tertiary">Needs Review</p>
            <p className="text-3xl font-bold text-brand-secondary">{posts.length}</p>
          </div>
          <div className="card-block p-5">
            <p className="text-sm text-text-tertiary">Resolved</p>
            <p className="text-3xl font-bold text-success">0</p>
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="card-block p-12 text-center">
            <p className="text-text-tertiary">No content to review</p>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <div key={post.id} className="card-block p-6">
                <div className="flex items-start gap-6">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={post.creator?.avatar_url || DEFAULT_AVATAR_CREATOR} />
                    <AvatarFallback className="bg-brand-primary-alpha-10 text-brand-primary">
                      {post.creator?.display_name?.[0]?.toUpperCase() || "C"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Link href={`/creator/${post.creator_id}`}>
                        <h3 className="text-lg font-semibold text-text-primary hover:text-brand-primary transition-colors">
                          {post.creator?.display_name || "Creator"}
                        </h3>
                      </Link>
                      {getVisibilityBadge(post.visibility ?? "free", post.price_cents ?? null)}
                      <span className="text-xs text-text-tertiary flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {post.created_at
                          ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
                          : "Unknown date"}
                      </span>
                    </div>

                    {post.title && (
                      <h4 className="text-base font-medium text-text-primary mb-2">{post.title}</h4>
                    )}
                    <p className="text-sm text-text-tertiary mb-4 line-clamp-2">{post.content}</p>

                    {/* Media Preview */}
                    {post.media && post.media.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                        {post.media.slice(0, 4).map((media) => (
                          <div
                            key={media.id}
                            className="aspect-video bg-surface-raised rounded-xl overflow-hidden"
                          >
                            {media.media_type === "image" ? (
                              <img
                                src={media.media_url}
                                alt="Post media"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <video
                                src={media.media_url}
                                className="w-full h-full object-cover"
                                muted
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-border-base">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="border-border-base bg-surface-base hover:bg-surface-raised rounded-xl active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
                      >
                        <Link href={`/post/${post.id}`}>
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Link>
                      </Button>
                      <Button
                        onClick={() => setDeletingPostId(post.id)}
                        variant="outline"
                        size="sm"
                        className="border-error text-error hover:bg-error/10 rounded-xl active:scale-95 focus-visible:ring-2 focus-visible:ring-error"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={deletingPostId !== null}
          onOpenChange={(open) => !open && setDeletingPostId(null)}
        >
          <AlertDialogContent className="bg-surface-base border-border-base rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-text-primary">Delete Content</AlertDialogTitle>
              <AlertDialogDescription className="text-text-tertiary">
                Are you sure you want to delete this content? This action cannot be undone. Purchase
                records will be preserved.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="deletion_reason">Deletion Reason (Optional)</Label>
                <Textarea
                  id="deletion_reason"
                  value={deletionReason}
                  onChange={(e) => setDeletionReason(e.target.value)}
                  placeholder="e.g., Violates content policy, copyright issues, etc."
                  className="bg-surface-base border-border-base rounded-xl"
                  rows={3}
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border-base bg-surface-base hover:bg-surface-raised rounded-xl">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingPostId && handleDelete(deletingPostId)}
                className="bg-error hover:bg-error/90 rounded-xl"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageShell>
  );
}
