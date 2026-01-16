"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureProfile } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
// getPost 和 updatePost 通过 API 调用，不直接导入
import { type Post } from "@/lib/types";
import { toast } from "sonner";
import { MultiMediaUpload } from "@/components/multi-media-upload";
import { type MediaFile } from "@/lib/storage";
import Link from "next/link";
import { Lock } from "lucide-react";

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

        // 加载 post 数据（通过 API）
        const response = await fetch(`/api/posts/${postId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Post not found");
          } else if (response.status === 403) {
            setError("Not authorized to edit this post");
          } else {
            setError("加载失败，请重试");
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

        // 转换现有媒体为 MediaFile 格式（用于显示）
        if (postData.media && postData.media.length > 0) {
          // 注意：编辑时，现有媒体会保留，新上传的会追加
          // 这里只设置新上传的文件，现有媒体在保存时会保留
        }
      } catch (err) {
        console.error("[edit-post] loadData error:", err);
        setError("加载失败，请重试");
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
      setError("用户未登录或 post 不存在");
      return;
    }

    if (!formData.content.trim()) {
      setError("Content 是必填项");
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
        toast.success("Post 更新成功！");
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-full max-w-2xl px-4">
          <div className="h-8 w-48 bg-[#121212] rounded"></div>
          <div className="h-64 bg-[#121212] rounded-3xl"></div>
          <div className="h-12 w-full bg-[#121212] rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error && !post) {
    return (
      <div className="min-h-screen bg-background">
        {currentUser && <NavHeader user={currentUser} notificationCount={0} />}
        <main className="container max-w-2xl mx-auto px-4 py-6">
          <div className="bg-card border border-border rounded-3xl p-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground mb-4">Error</h1>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button onClick={() => router.push("/creator/studio/post/list")}>返回列表</Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {currentUser && <NavHeader user={currentUser} notificationCount={0} />}

      <main className="container max-w-2xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Edit Post</h1>
          <p className="text-muted-foreground">修改你的内容（价格和可见性已锁定）</p>
        </div>

        {error && (
          <div className="bg-[#F43F5E]/10 border border-[#F43F5E]/20 rounded-3xl p-6 mb-8">
            <p className="text-destructive font-medium">错误</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        )}

        <div className="bg-card border border-border rounded-3xl p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Locked Visibility & Price Info */}
            <div className="bg-[#121212] border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Lock className="w-4 h-4" />
                <span className="text-sm font-medium">价格和可见性已锁定（不可修改）</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  className={
                    post.visibility === "free"
                      ? "bg-green-500/10 text-green-600 dark:text-green-400 border-[#10B981]/20 rounded-lg"
                      : post.visibility === "subscribers"
                        ? "bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/20 rounded-lg"
                        : "bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]/20 rounded-lg"
                  }
                >
                  {post.visibility === "free"
                    ? "Free"
                    : post.visibility === "subscribers"
                      ? "Subscribers"
                      : `PPV $${((post.price_cents || 0) / 100).toFixed(2)}`}
                </Badge>
                {post.visibility === "ppv" && (
                  <span className="text-sm text-muted-foreground">
                    Price: ${((post.price_cents || 0) / 100).toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title (可选)</Label>
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
                Content <span className="text-destructive">*</span>
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
              <Label>Media (可选，支持多文件，新上传的文件会追加到现有媒体)</Label>
              {post.media && post.media.length > 0 && (
                <div className="mb-3 p-3 bg-[#121212] rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">
                    现有媒体 ({post.media.length} 个文件)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {post.media.map((media) => (
                      <div key={media.id} className="text-xs text-muted-foreground">
                        {media.media_type === "image" ? "🖼️" : "🎥"} {media.file_name || "media"}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <MultiMediaUpload
                onUploadComplete={(files) => {
                  setMediaFiles(files);
                  toast.success(`已上传 ${files.length} 个新文件`);
                }}
                onUploadError={(error) => {
                  setError(error);
                  toast.error(error);
                }}
                maxFiles={10}
              />
              {mediaFiles.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  新上传 {mediaFiles.length} 个文件（将追加到现有媒体）
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
                className="flex-1 border-border bg-card hover:bg-[#1A1A1A] rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="gradient"
                disabled={isSaving}
                className="flex-1 rounded-xl"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
