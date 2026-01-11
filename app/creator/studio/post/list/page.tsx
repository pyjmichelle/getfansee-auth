"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
// listCreatorPosts, updatePost, deletePost 通过 API 调用，不直接导入
import { type Post } from "@/lib/types";
import { MediaDisplay } from "@/components/media-display";
import { Edit, Trash2, Eye, Heart, DollarSign, Plus, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
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

const supabase = getSupabaseBrowserClient();

export default function CreatorPostListPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setCurrentUserId(session.user.id);

        const profile = await getProfile(session.user.id);
        if (profile) {
          setCurrentUser({
            username: profile.display_name || "user",
            role: (profile.role || "fan") as "fan" | "creator",
            avatar: profile.avatar_url || undefined,
          });

          if (profile.role !== "creator") {
            router.push("/home");
            return;
          }

          // 加载内容列表（通过 API）
          const response = await fetch("/api/posts/creator");
          if (response.ok) {
            const data = await response.json();
            setPosts(data.posts || []);
          } else {
            console.error("[post-list] Failed to fetch posts");
          }
        }
      } catch (err) {
        console.error("[post-list] loadData error:", err);
        setError("加载失败，请重试");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router]);

  const handleDelete = async (postId: string) => {
    try {
      setDeletingPostId(postId);
      const response = await fetch(`/api/posts/${postId}/delete`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (result.success) {
        // 从列表中移除已删除的帖子
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      } else {
        setError(result.error || "删除失败，请重试");
      }
    } catch (err) {
      console.error("[post-list] delete error:", err);
      setError("删除失败，请重试");
    } finally {
      setDeletingPostId(null);
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
        <main className="container max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
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

      <main className="container max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">My Posts</h1>
            <p className="text-muted-foreground">Manage all your published content</p>
          </div>
          <Button asChild variant="gradient" size="lg" className="w-full sm:w-auto rounded-xl">
            <Link href="/creator/new-post">
              <Plus className="w-5 h-5 mr-2" />
              New Post
            </Link>
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
            {error}
          </div>
        )}

        {posts.length === 0 ? (
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-12 text-center">
            <p className="text-muted-foreground mb-4">No posts yet</p>
            <Button asChild variant="gradient" className="rounded-xl">
              <Link href="/creator/new-post">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Post
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-6 hover:border-[#262626] transition-colors"
              >
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Media Preview */}
                  {post.media && post.media.length > 0 && (
                    <div className="md:w-48 aspect-video md:aspect-auto rounded-xl overflow-hidden bg-[#121212]">
                      {post.media[0].media_type === "image" ? (
                        <img
                          src={post.media[0].media_url}
                          alt="Post preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          src={post.media[0].media_url}
                          className="w-full h-full object-cover"
                          muted
                        />
                      )}
                    </div>
                  )}

                  {/* Post Details */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getVisibilityBadge(post.visibility, post.price_cents)}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        {post.title && (
                          <h3 className="text-lg font-semibold text-foreground mb-2">
                            {post.title}
                          </h3>
                        )}
                        <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                      </div>
                    </div>

                    {/* Stats (placeholder - 实际应从数据库获取) */}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-4">
                      <div className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        <span>0 views</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="w-4 h-4" />
                        <span>0 likes</span>
                      </div>
                      {post.visibility === "ppv" && (
                        <div className="flex items-center gap-1 text-[#10B981]">
                          <DollarSign className="w-4 h-4" />
                          <span>$0</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex md:flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 md:flex-none border-[#1F1F1F] bg-[#0D0D0D] hover:bg-[#1A1A1A] rounded-xl"
                      asChild
                    >
                      <Link href={`/creator/studio/post/edit/${post.id}`}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 md:flex-none text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
                      onClick={() => setDeletingPostId(post.id)}
                      disabled={deletingPostId === post.id}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
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
              <AlertDialogTitle className="text-foreground">Delete Post</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Are you sure you want to delete this post? This action cannot be undone. Purchase
                records will be preserved.
              </AlertDialogDescription>
            </AlertDialogHeader>
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
