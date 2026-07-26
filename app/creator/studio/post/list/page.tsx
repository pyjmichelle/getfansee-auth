"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { StudioShell } from "@/components/shells/studio-shell";
import { useAuth } from "@/contexts/auth-context";
import { type Post } from "@/lib/types";
import {
  Edit,
  Trash2,
  Eye,
  Heart,
  DollarSign,
  Plus,
  Calendar,
  Search,
  List,
  Grid3X3,
  Lock,
  CheckCircle,
  FileText,
  Download,
} from "@/lib/icons";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useCountUp } from "@/hooks/use-count-up";
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
import { Button } from "@/components/ui/button";

export default function CreatorPostListPage() {
  const router = useRouter();
  const auth = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [filterStatus, setFilterStatus] = useState<"all" | "published" | "locked" | "draft">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (!auth.authenticated || !auth.user) {
          router.push("/auth");
          return;
        }

        if (auth.profile) {
          setCurrentUser({
            username: auth.profile.display_name || "user",
            role: (auth.profile.role || "fan") as "fan" | "creator",
            avatar: auth.profile.avatar_url || undefined,
          });

          if (auth.profile.role !== "creator") {
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
        setError("Failed to load. Please try again");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router, auth.authenticated, auth.user, auth.profile]);

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
        setError(result.error || "Delete failed. Please try again");
      }
    } catch (err) {
      console.error("[post-list] delete error:", err);
      setError("Delete failed. Please try again");
    } finally {
      setDeletingPostId(null);
    }
  };

  // Filter posts based on status and search
  const filteredPosts = posts.filter((post) => {
    const matchesSearch =
      searchQuery === "" ||
      post.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterStatus === "all" ||
      (filterStatus === "published" && post.visibility !== "draft") ||
      (filterStatus === "locked" &&
        (post.visibility === "subscribers" || post.visibility === "ppv")) ||
      (filterStatus === "draft" && post.visibility === "draft");
    return matchesSearch && matchesFilter;
  });

  // Stats calculations
  const totalPosts = posts.length;
  const publishedPosts = posts.filter((p) => p.visibility !== "draft").length;
  const premiumPosts = posts.filter(
    (p) => p.visibility === "subscribers" || p.visibility === "ppv"
  ).length;
  const totalLikes = posts.reduce((sum, p) => sum + (p.likes_count || 0), 0);
  const animatedLikes = useCountUp(totalLikes, { duration: 900, decimals: 0 });

  const handleExportCsv = () => {
    const header = ["Title", "Status", "Visibility", "Price (USD)", "Likes", "Created"];
    const rows = filteredPosts.map((p) => [
      p.title || p.content?.slice(0, 50) || "Untitled",
      p.visibility === "draft" ? "draft" : "published",
      p.visibility || "free",
      p.price_cents ? (p.price_cents / 100).toFixed(2) : "",
      String(p.likes_count || 0),
      p.created_at ? new Date(p.created_at).toISOString() : "",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `posts-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <PageShell user={currentUser} notificationCount={0} maxWidth="6xl">
        <div className="pb-24 animate-pulse space-y-6">
          <div className="h-10 w-64 bg-surface-raised rounded" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-surface-raised rounded-2xl" />
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-surface-raised rounded-2xl" />
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell user={currentUser} notificationCount={0} maxWidth="6xl">
      <div className="pb-24">
        <StudioShell>
          {/* Header */}
          <div className="mb-4 md:mb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-1 md:mb-3 text-text-primary">
                  Content Library
                </h1>
                <p className="text-text-tertiary text-small md:text-lg">
                  Manage your posts and media
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="px-5 py-3 bg-surface-raised border-border-base hover:bg-surface-overlay"
                  onClick={handleExportCsv}
                >
                  <Download size={18} />
                  Export
                </Button>
                <Button asChild className="px-5 py-3">
                  <Link href="/creator/new-post">
                    <Plus size={18} />
                    Create Post
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="bento-grid mb-8">
            <div className="card-block p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-small text-text-tertiary font-semibold">Total Posts</div>
                <div className="w-12 h-12 bg-[var(--wine)]/10 rounded-xl flex items-center justify-center">
                  <FileText size={20} className="text-wine-text" />
                </div>
              </div>
              <div className="text-3xl font-bold text-text-primary">{totalPosts}</div>
            </div>
            <div className="card-block p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-small text-text-tertiary font-semibold">Published</div>
                <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                  <CheckCircle size={20} className="text-success" />
                </div>
              </div>
              <div className="text-3xl font-bold text-text-primary">{publishedPosts}</div>
            </div>
            <div className="card-block p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-small text-text-tertiary font-semibold">Premium</div>
                <div className="w-12 h-12 bg-brand-secondary/10 rounded-xl flex items-center justify-center">
                  <Lock size={20} className="text-wine-text" />
                </div>
              </div>
              <div className="text-3xl font-bold text-text-primary">{premiumPosts}</div>
            </div>
            <div className="card-block p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-small text-text-tertiary font-semibold">Total Likes</div>
                <div className="w-12 h-12 bg-error/10 rounded-xl flex items-center justify-center">
                  <Heart size={20} className="text-error" />
                </div>
              </div>
              <div className="text-3xl font-bold text-text-primary">{animatedLikes.toFixed(0)}</div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-xl text-error">
              {error}
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary"
                size={18}
              />
              <input
                type="text"
                placeholder="Search content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-surface-raised border border-border-base rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--wine)]/20 focus:border-[var(--border-wine)] transition-all placeholder:text-text-tertiary"
              />
            </div>

            <div className="flex gap-3">
              <div className="snap-row bg-surface-raised border border-border-base rounded-xl p-1">
                {(["all", "published", "locked", "draft"] as const).map((status) => (
                  <Button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    variant={filterStatus === status ? "default" : "ghost"}
                    size="sm"
                    className={`rounded-lg capitalize ${
                      filterStatus === status
                        ? "bg-[var(--wine)] text-white shadow-md"
                        : "text-text-tertiary hover:text-text-primary hover:bg-surface-overlay"
                    }`}
                  >
                    {status}
                  </Button>
                ))}
              </div>

              <div className="flex gap-1 bg-surface-raised border border-border-base rounded-xl p-1">
                <Button
                  onClick={() => setViewMode("list")}
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="icon"
                  className={`rounded-lg ${
                    viewMode === "list"
                      ? "bg-[var(--wine)] text-white shadow-md"
                      : "text-text-tertiary hover:bg-surface-overlay"
                  }`}
                >
                  <List size={18} />
                </Button>
                <Button
                  onClick={() => setViewMode("grid")}
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="icon"
                  className={`rounded-lg ${
                    viewMode === "grid"
                      ? "bg-[var(--wine)] text-white shadow-md"
                      : "text-text-tertiary hover:bg-surface-overlay"
                  }`}
                >
                  <Grid3X3 size={18} />
                </Button>
              </div>
            </div>
          </div>

          {/* Content List */}
          {viewMode === "list" ? (
            <div className="space-y-4" data-testid="creator-post-list">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className="bg-surface-base border border-border-base hover:border-[var(--border-wine)]/30 rounded-2xl p-6 transition-all group hover:shadow-lg"
                  data-testid="creator-post-list-item"
                  data-post-id={post.id}
                >
                  <div className="flex gap-6">
                    {/* Thumbnail */}
                    <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-xl overflow-hidden flex-shrink-0 bg-surface-raised">
                      {post.media && post.media.length > 0 && post.media[0].media_url ? (
                        post.media[0].media_type === "image" ? (
                          <img
                            src={post.media[0].media_url}
                            alt={post.title || "Post preview"}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <video
                            src={post.media[0].media_url}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            muted
                          />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText size={32} className="text-text-quaternary" />
                        </div>
                      )}
                      {(post.visibility === "subscribers" || post.visibility === "ppv") && (
                        <div className="absolute top-2 left-2 px-2.5 py-1.5 bg-brand-secondary/90 backdrop-blur-sm rounded-lg text-tiny font-semibold flex items-center gap-1.5 text-white">
                          <Lock size={12} />
                          {post.visibility === "ppv"
                            ? `$${((post.price_cents || 0) / 100).toFixed(2)}`
                            : "Exclusive"}
                        </div>
                      )}
                    </div>

                    {/* Content Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-2 truncate group-hover:text-wine-text transition-colors text-text-primary">
                            {post.title || post.content?.slice(0, 50) || "Untitled Post"}
                          </h3>
                          <div className="flex items-center gap-4 text-small text-text-tertiary">
                            <div className="flex items-center gap-2">
                              <Calendar size={14} />
                              {post.created_at
                                ? formatDistanceToNow(new Date(post.created_at), {
                                    addSuffix: true,
                                  })
                                : "Not published"}
                            </div>
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  post.visibility !== "draft" ? "bg-success" : "bg-text-quaternary"
                                }`}
                              />
                              <span className="capitalize">
                                {post.visibility === "draft" ? "draft" : "published"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Link
                            href={`/creator/studio/post/edit/${post.id}`}
                            className="p-2 hover:bg-surface-raised rounded-lg transition-all active:scale-[0.98]"
                          >
                            <Edit size={18} className="text-text-tertiary" />
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingPostId(post.id)}
                            className="rounded-lg hover:bg-surface-raised"
                          >
                            <Trash2 size={18} className="text-text-tertiary hover:text-error" />
                          </Button>
                        </div>
                      </div>

                      {/* Performance Metrics */}
                      <div className="flex items-center gap-6 text-small flex-wrap">
                        <div className="flex items-center gap-2">
                          <Heart size={16} className="text-text-tertiary" />
                          <span className="font-semibold text-text-primary">
                            {post.likes_count || 0}
                          </span>
                          <span className="text-text-tertiary">likes</span>
                        </div>
                        {post.visibility === "ppv" && !!post.price_cents && (
                          <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-success/10 rounded-xl">
                            <DollarSign size={16} className="text-success" />
                            <span className="font-bold text-success">
                              ${(post.price_cents / 100).toFixed(2)}
                            </span>
                            <span className="text-text-tertiary text-tiny">price</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bento-grid" data-testid="creator-post-list">
              {filteredPosts.map((post, index) => (
                <div
                  key={post.id}
                  className={`card-block overflow-hidden transition-all group hover:shadow-lg ${
                    index === 0 ? "bento-2x1" : ""
                  }`}
                  data-testid="creator-post-list-item"
                  data-post-id={post.id}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-surface-raised">
                    {post.media && post.media.length > 0 && post.media[0].media_url ? (
                      post.media[0].media_type === "image" ? (
                        <img
                          src={post.media[0].media_url}
                          alt={post.title || "Post preview"}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <video
                          src={post.media[0].media_url}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          muted
                        />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText size={48} className="text-text-quaternary" />
                      </div>
                    )}
                    {(post.visibility === "subscribers" || post.visibility === "ppv") && (
                      <div className="absolute top-3 left-3 px-3 py-2 bg-brand-secondary/90 backdrop-blur-sm rounded-xl text-small font-semibold flex items-center gap-2 text-white">
                        <Lock size={14} />
                        {post.visibility === "ppv"
                          ? `$${((post.price_cents || 0) / 100).toFixed(2)}`
                          : "Exclusive"}
                      </div>
                    )}

                    {/* Hover Actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <Link
                        href={`/posts/${post.id}`}
                        className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-xl font-medium hover:bg-white/20 transition-all active:scale-[0.98] flex items-center gap-2"
                      >
                        <Eye size={16} />
                        View
                      </Link>
                      <Link
                        href={`/creator/studio/post/edit/${post.id}`}
                        className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-xl font-medium hover:bg-white/20 transition-all active:scale-[0.98] flex items-center gap-2"
                      >
                        <Edit size={16} />
                        Edit
                      </Link>
                    </div>
                  </div>

                  {/* Content Info */}
                  <div className="p-5">
                    <h3 className="font-semibold mb-3 line-clamp-2 group-hover:text-wine-text transition-colors text-text-primary">
                      {post.title || post.content?.slice(0, 50) || "Untitled Post"}
                    </h3>

                    <div className="flex items-center gap-3 text-tiny text-text-tertiary mb-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            post.visibility !== "draft" ? "bg-success" : "bg-text-quaternary"
                          }`}
                        />
                        <span className="capitalize">
                          {post.visibility === "draft" ? "draft" : "published"}
                        </span>
                      </div>
                      {post.created_at && (
                        <span>
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>

                    {/* Metrics */}
                    <div className="flex items-center gap-4 text-small">
                      <div className="flex items-center gap-1.5">
                        <Heart size={14} className="text-text-tertiary" />
                        <span className="font-semibold text-text-primary">
                          {post.likes_count || 0}
                        </span>
                      </div>
                      {post.visibility === "ppv" && !!post.price_cents && (
                        <div className="ml-auto flex items-center gap-1 text-success">
                          <DollarSign size={14} />
                          <span className="font-bold">${(post.price_cents / 100).toFixed(0)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {filteredPosts.length === 0 && (
            <div className="py-20 text-center">
              <div className="w-20 h-20 bg-surface-raised rounded-full flex items-center justify-center mx-auto mb-6">
                <Grid3X3 size={32} className="text-text-quaternary" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-text-primary">No content found</h3>
              <p className="text-text-tertiary mb-8">
                {filterStatus === "all"
                  ? "Create your first post to get started"
                  : `No ${filterStatus} content yet`}
              </p>
              <Button asChild>
                <Link href="/creator/new-post">
                  <Plus size={18} />
                  Create Post
                </Link>
              </Button>
            </div>
          )}

          {/* Delete Confirmation Dialog */}
          <AlertDialog
            open={deletingPostId !== null}
            onOpenChange={(open) => !open && setDeletingPostId(null)}
          >
            <AlertDialogContent className="bg-surface-base border-border-base rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-text-primary">Delete Post</AlertDialogTitle>
                <AlertDialogDescription className="text-text-tertiary">
                  Are you sure you want to delete this post? This action cannot be undone. Purchase
                  records will be preserved.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-border-base bg-surface-raised hover:bg-surface-overlay rounded-xl">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deletingPostId && handleDelete(deletingPostId)}
                  className="bg-error hover:bg-error/90 rounded-xl text-white"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </StudioShell>
      </div>
    </PageShell>
  );
}
