"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
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
  MoreVertical,
  MessageCircle,
  Unlock,
  Download,
} from "lucide-react";
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
import { BottomNavigation } from "@/components/bottom-navigation";

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
        setError("Failed to load. Please try again");
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
  const totalRevenue = posts.reduce((sum, p) => sum + (p.price_cents || 0) / 100, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        {currentUser && <NavHeader user={currentUser} notificationCount={0} />}
        <div className="pt-20 md:pt-24 px-4 md:px-6 max-w-7xl mx-auto pb-12">
          <div className="animate-pulse space-y-6">
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {currentUser && <NavHeader user={currentUser} notificationCount={0} />}

      <div className="pt-20 md:pt-24 px-4 md:px-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-text-primary">
                Content Library
              </h1>
              <p className="text-text-tertiary text-lg">Manage your posts and media</p>
            </div>
            <div className="flex gap-3">
              <button className="px-5 py-3 bg-surface-raised border border-border-base rounded-xl font-semibold hover:bg-surface-overlay transition-all flex items-center gap-2 active:scale-95">
                <Download size={18} />
                Export
              </button>
              <Link
                href="/creator/new-post"
                className="px-6 py-3 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-brand-primary/25 active:scale-95"
              >
                <Plus size={18} />
                Create Post
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
          <div className="bg-surface-base border border-border-base rounded-2xl p-6 hover:border-brand-primary/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-text-tertiary font-semibold">Total Posts</div>
              <div className="w-12 h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center">
                <FileText size={20} className="text-brand-primary" />
              </div>
            </div>
            <div className="text-3xl font-bold text-text-primary">{totalPosts}</div>
          </div>
          <div className="bg-surface-base border border-border-base rounded-2xl p-6 hover:border-success/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-text-tertiary font-semibold">Published</div>
              <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                <CheckCircle size={20} className="text-success" />
              </div>
            </div>
            <div className="text-3xl font-bold text-text-primary">{publishedPosts}</div>
          </div>
          <div className="bg-surface-base border border-border-base rounded-2xl p-6 hover:border-brand-secondary/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-text-tertiary font-semibold">Premium</div>
              <div className="w-12 h-12 bg-brand-secondary/10 rounded-xl flex items-center justify-center">
                <Lock size={20} className="text-brand-secondary" />
              </div>
            </div>
            <div className="text-3xl font-bold text-text-primary">{premiumPosts}</div>
          </div>
          <div className="bg-gradient-subtle border border-border-base rounded-2xl p-6 hover:border-success/30 transition-all relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent" />
            <div className="relative flex items-center justify-between mb-3">
              <div className="text-sm text-text-tertiary font-semibold">Total Revenue</div>
              <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                <DollarSign size={20} className="text-success" />
              </div>
            </div>
            <div className="relative text-3xl font-bold text-gradient-primary">
              ${totalRevenue.toFixed(0)}
            </div>
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
              className="w-full pl-12 pr-4 py-3 bg-surface-raised border border-border-base rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all placeholder:text-text-tertiary"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex gap-1 bg-surface-raised border border-border-base rounded-xl p-1">
              {(["all", "published", "locked", "draft"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize active:scale-95 ${
                    filterStatus === status
                      ? "bg-brand-primary text-white shadow-md"
                      : "text-text-tertiary hover:text-text-primary hover:bg-surface-overlay"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="flex gap-1 bg-surface-raised border border-border-base rounded-xl p-1">
              <button
                onClick={() => setViewMode("list")}
                className={`p-2.5 rounded-lg transition-all active:scale-95 ${
                  viewMode === "list"
                    ? "bg-brand-primary text-white shadow-md"
                    : "text-text-tertiary hover:bg-surface-overlay"
                }`}
              >
                <List size={18} />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2.5 rounded-lg transition-all active:scale-95 ${
                  viewMode === "grid"
                    ? "bg-brand-primary text-white shadow-md"
                    : "text-text-tertiary hover:bg-surface-overlay"
                }`}
              >
                <Grid3X3 size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Content List */}
        {viewMode === "list" ? (
          <div className="space-y-4" data-testid="creator-post-list">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className="bg-surface-base border border-border-base hover:border-brand-primary/30 rounded-2xl p-6 transition-all group hover:shadow-lg"
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
                      <div className="absolute top-2 left-2 px-2.5 py-1.5 bg-brand-secondary/90 backdrop-blur-sm rounded-lg text-xs font-semibold flex items-center gap-1.5 text-white">
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
                        <h3 className="font-semibold text-lg mb-2 truncate group-hover:text-brand-primary transition-colors text-text-primary">
                          {post.title || post.content?.slice(0, 50) || "Untitled Post"}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-text-tertiary">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} />
                            {post.created_at
                              ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
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
                          className="p-2 hover:bg-surface-raised rounded-lg transition-all active:scale-95"
                        >
                          <Edit size={18} className="text-text-tertiary" />
                        </Link>
                        <button
                          onClick={() => setDeletingPostId(post.id)}
                          className="p-2 hover:bg-surface-raised rounded-lg transition-all active:scale-95"
                        >
                          <Trash2 size={18} className="text-text-tertiary hover:text-error" />
                        </button>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="flex items-center gap-6 text-sm flex-wrap">
                      <div className="flex items-center gap-2">
                        <Eye size={16} className="text-text-tertiary" />
                        <span className="font-semibold text-text-primary">0</span>
                        <span className="text-text-tertiary">views</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Heart size={16} className="text-text-tertiary" />
                        <span className="font-semibold text-text-primary">0</span>
                        <span className="text-text-tertiary">likes</span>
                      </div>
                      {post.visibility === "ppv" && (
                        <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-success/10 rounded-xl">
                          <DollarSign size={16} className="text-success" />
                          <span className="font-bold text-success">$0.00</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            data-testid="creator-post-list"
          >
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className="bg-surface-base border border-border-base hover:border-brand-primary/30 rounded-2xl overflow-hidden transition-all group hover:shadow-lg"
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
                    <div className="absolute top-3 left-3 px-3 py-2 bg-brand-secondary/90 backdrop-blur-sm rounded-xl text-sm font-semibold flex items-center gap-2 text-white">
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
                      className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-xl font-medium hover:bg-white/20 transition-all active:scale-95 flex items-center gap-2"
                    >
                      <Eye size={16} />
                      View
                    </Link>
                    <Link
                      href={`/creator/studio/post/edit/${post.id}`}
                      className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-xl font-medium hover:bg-white/20 transition-all active:scale-95 flex items-center gap-2"
                    >
                      <Edit size={16} />
                      Edit
                    </Link>
                  </div>
                </div>

                {/* Content Info */}
                <div className="p-5">
                  <h3 className="font-semibold mb-3 line-clamp-2 group-hover:text-brand-primary transition-colors text-text-primary">
                    {post.title || post.content?.slice(0, 50) || "Untitled Post"}
                  </h3>

                  <div className="flex items-center gap-3 text-xs text-text-tertiary mb-4">
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
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Eye size={14} className="text-text-tertiary" />
                      <span className="font-semibold text-text-primary">0</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Heart size={14} className="text-text-tertiary" />
                      <span className="font-semibold text-text-primary">0</span>
                    </div>
                    {post.visibility === "ppv" && (
                      <div className="ml-auto flex items-center gap-1 text-success">
                        <DollarSign size={14} />
                        <span className="font-bold">$0</span>
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
            <Link
              href="/creator/new-post"
              className="px-6 py-3 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/25 active:scale-95 inline-flex items-center gap-2"
            >
              <Plus size={18} />
              Create Post
            </Link>
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
      </div>

      <BottomNavigation notificationCount={0} userRole={currentUser?.role} />
    </div>
  );
}
