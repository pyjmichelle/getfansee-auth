"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { type Post } from "@/lib/types";
import { toast } from "sonner";
import { MultiMediaUpload } from "@/components/multi-media-upload";
import { type MediaFile } from "@/lib/storage";
import { Lock } from "@/lib/icons";

const supabase = getSupabaseBrowserClient();

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const postId = (params?.id as string) || "";

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [post, setPost] = useState<Post | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
  });
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);

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
        }

        const response = await fetch(`/api/posts/${postId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Post not found");
          } else if (response.status === 403) {
            setError("Not authorized to edit this post");
          } else {
            setError("Failed to load. Please try again");
          }
          return;
        }

        const data = await response.json();
        const postData = data.post;
        if (!postData) {
          setError("Post not found");
          return;
        }

        setPost(postData);
        setFormData({
          title: postData.title || "",
          content: postData.content,
        });

        if (postData.media && postData.media.length > 0) {
          // Existing media preserved on save; new uploads appended
        }
      } catch (err) {
        console.error("[edit-post] loadData error:", err);
        setError("Failed to load. Please try again");
      } finally {
        setIsLoading(false);
      }
    };

    if (postId) {
      loadData();
    }
  }, [postId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUserId || !post) {
      setError("User not logged in or post does not exist");
      return;
    }

    if (!formData.content.trim()) {
      setError("Content is required");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch(`/api/posts/${postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title.trim() || undefined,
          content: formData.content.trim(),
          mediaFiles: mediaFiles.length > 0 ? mediaFiles : undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Post updated successfully");
        setTimeout(() => {
          router.push("/creator/studio/post/list");
        }, 500);
      } else {
        setError(result.error || "更新失败，请重试");
      }
    } catch (err) {
      console.error("[edit-post] handleSubmit error:", err);
      setError("更新失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <PageShell user={currentUser} notificationCount={0} maxWidth="2xl">
        <div className="animate-pulse space-y-4 py-8">
          <div className="h-8 w-48 bg-surface-raised rounded"></div>
          <div className="h-64 bg-surface-raised rounded-2xl"></div>
          <div className="h-12 w-full bg-surface-raised rounded-xl"></div>
        </div>
      </PageShell>
    );
  }

  if (error && !post) {
    return (
      <PageShell user={currentUser} notificationCount={0} maxWidth="2xl">
        <div className="section-block py-6">
          <div className="card-block p-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-text-primary mb-4">Error</h1>
              <p className="text-text-secondary mb-6">{error}</p>
              <Button onClick={() => router.push("/creator/studio/post/list")}>Back to List</Button>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!post) {
    return null;
  }

  return (
    <PageShell user={currentUser} notificationCount={0} maxWidth="2xl">
      <div className="section-block py-8 md:py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Edit Post</h1>
          <p className="text-text-secondary">Edit your content (price and visibility are locked)</p>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/20 rounded-2xl p-6 mb-8">
            <p className="text-error font-medium">Error</p>
            <p className="text-sm text-text-secondary mt-1">{error}</p>
          </div>
        )}

        <div className="card-block p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Locked Visibility & Price Info */}
            <div className="bg-surface-raised border border-border-base rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-text-tertiary">
                <Lock className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Price and visibility are locked (cannot be modified)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  className={
                    post.visibility === "free"
                      ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 rounded-lg"
                      : post.visibility === "subscribers"
                        ? "bg-brand-primary/10 text-brand-primary border-brand-primary/20 rounded-lg"
                        : "glass bg-[var(--bg-purple-500-10)] text-[var(--color-purple-400)] border-[var(--border-purple-500-20)] rounded-lg"
                  }
                >
                  {post.visibility === "free"
                    ? "Free"
                    : post.visibility === "subscribers"
                      ? "Exclusive"
                      : `Premium $${((post.price_cents || 0) / 100).toFixed(2)}`}
                </Badge>
                {post.visibility === "ppv" && (
                  <span className="text-sm text-text-tertiary">
                    Price: ${((post.price_cents || 0) / 100).toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title (Optional)</Label>
              <Input
                id="title"
                type="text"
                placeholder="Post title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={isSaving}
              />
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="content">
                Content <span className="text-error">*</span>
              </Label>
              <Textarea
                id="content"
                placeholder="Write your post content..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={6}
                required
                disabled={isSaving}
              />
            </div>

            {/* Multi Media Upload */}
            <div className="space-y-2">
              <Label>
                Media (Optional, supports multiple files. New uploads will be appended to existing
                media)
              </Label>
              {post.media && post.media.length > 0 && (
                <div className="mb-3 p-3 bg-surface-raised rounded-lg">
                  <p className="text-xs text-text-tertiary mb-2">
                    Existing media ({post.media.length} file{post.media.length > 1 ? "s" : ""})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {post.media.map((media) => (
                      <div key={media.id} className="text-xs text-text-tertiary">
                        {media.media_type === "image" ? "🖼️" : "🎥"} {media.file_name || "media"}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <MultiMediaUpload
                onUploadComplete={(files) => {
                  setMediaFiles(files);
                  toast.success(`${files.length} new file${files.length > 1 ? "s" : ""} uploaded`);
                }}
                onUploadError={(uploadError) => {
                  setError(uploadError);
                  toast.error(uploadError);
                }}
                maxFiles={10}
              />
              {mediaFiles.length > 0 && (
                <p className="text-xs text-text-tertiary mt-2">
                  {mediaFiles.length} new file{mediaFiles.length > 1 ? "s" : ""} uploaded (will be
                  appended to existing media)
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/creator/studio/post/list")}
                disabled={isSaving}
                className="flex-1 border-border-base bg-surface-base hover:bg-surface-raised rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="gradient"
                disabled={isSaving}
                className="flex-1 rounded-xl shadow-glow hover-bold"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
