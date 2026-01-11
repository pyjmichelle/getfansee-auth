"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
// listFeed 通过 API 调用，不直接导入
import { Trash2, Eye, Calendar } from "lucide-react";
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
import type { Post } from "@/lib/types";

const supabase = getSupabaseBrowserClient();

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

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

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
            username: profile.display_name || "user",
            role: (profile.role || "fan") as "fan" | "creator",
            avatar: profile.avatar_url || undefined,
          });

          // TODO: 检查是否为管理员（这里简化处理，实际应该检查 admin 角色）
          // 暂时允许所有用户访问，实际应该添加权限检查
        }

        // 加载最近发布的内容（最近 50 条，通过 API）
        const response = await fetch("/api/admin/posts?limit=50");
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
      // 软删除：设置 deleted_at 和 removed_by_admin
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("请先登录");
        return;
      }

      const { error } = await supabase
        .from("posts")
        .update({
          deleted_at: new Date().toISOString(),
          removed_by_admin: true,
        })
        .eq("id", postId);

      if (error) {
        console.error("[admin-content-review] delete error:", error);
        toast.error("删除失败，请重试");
        return;
      }

      toast.success("内容已删除");
      // 重新加载列表（通过 API）
      const response = await fetch("/api/admin/posts?limit=50");
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      }
      setDeletingPostId(null);
      setDeletionReason("");
    } catch (err) {
      console.error("[admin-content-review] delete exception:", err);
      toast.error("删除失败，请重试");
    }
  };

  const getVisibilityBadge = (visibility: string, priceCents: number | null) => {
    if (visibility === "free") {
      return (
        <Badge className="bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20 rounded-lg">
          Free
        </Badge>
      );
    } else if (visibility === "subscribers") {
      return (
        <Badge className="bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/20 rounded-lg">
          Subscribers
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]/20 rounded-lg">
          PPV ${((priceCents || 0) / 100).toFixed(2)}
        </Badge>
      );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505]">
        {currentUser && <NavHeader user={currentUser} notificationCount={0} />}
        <main className="container max-w-6xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-[#121212] rounded-3xl"></div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      {currentUser && <NavHeader user={currentUser} notificationCount={0} />}

      <main className="container max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Content Review</h1>
          <p className="text-muted-foreground">Review and moderate recently published content</p>
        </div>

        {posts.length === 0 ? (
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-12 text-center">
            <p className="text-muted-foreground">No content to review</p>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-6 hover:border-[#262626] transition-colors"
              >
                <div className="flex items-start gap-6">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={post.creator?.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {post.creator?.display_name?.[0]?.toUpperCase() || "C"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Link href={`/creator/${post.creator_id}`}>
                        <h3 className="text-lg font-semibold text-foreground hover:text-primary transition-colors">
                          {post.creator?.display_name || "Creator"}
                        </h3>
                      </Link>
                      {getVisibilityBadge(post.visibility, post.price_cents)}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    {post.title && (
                      <h4 className="text-base font-medium text-foreground mb-2">{post.title}</h4>
                    )}
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {post.content}
                    </p>

                    {/* Media Preview */}
                    {post.media && post.media.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                        {post.media.slice(0, 4).map((media) => (
                          <div
                            key={media.id}
                            className="aspect-video bg-[#121212] rounded-xl overflow-hidden"
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
                    <div className="flex gap-3 pt-4 border-t border-[#1F1F1F]">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="border-[#1F1F1F] bg-[#0D0D0D] hover:bg-[#1A1A1A] rounded-xl"
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
                        className="border-[#F43F5E] text-[#F43F5E] hover:bg-[#F43F5E]/10 rounded-xl"
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
          <AlertDialogContent className="bg-[#0D0D0D] border-[#1F1F1F] rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">Delete Content</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
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
                  placeholder="例如：违规内容、版权问题等"
                  className="bg-[#0D0D0D] border-[#1F1F1F] rounded-xl"
                  rows={3}
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-[#1F1F1F] bg-[#0D0D0D] hover:bg-[#1A1A1A] rounded-xl">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingPostId && handleDelete(deletingPostId)}
                className="bg-destructive hover:bg-destructive/90 rounded-xl"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
