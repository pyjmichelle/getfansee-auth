"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CenteredContainer } from "@/components/layouts/centered-container";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
// 所有服务器端函数都通过 API 调用，不直接导入
import { type PostVisibility } from "@/lib/types";
import { toast } from "sonner";
import { MultiMediaUpload } from "@/components/multi-media-upload";
import { TagSelector } from "@/components/tag-selector";
import { type MediaFile } from "@/lib/storage";
import Link from "next/link";

const supabase = getSupabaseBrowserClient();

export default function NewPostPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: "fan" | "creator";
    avatar?: string;
  } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    media_url: "", // 向后兼容
    visibility: "free" as PostVisibility,
    price: "",
    preview_enabled: false,
    watermark_enabled: true, // 默认开启
  });
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          router.push("/auth");
          return;
        }

        // 确保 profile 存在（通过 API）
        await fetch("/api/auth/ensure-profile", { method: "POST" });
        setCurrentUserId(session.user.id);

        // 加载 profile（通过 API）
        const profileResponse = await fetch("/api/profile");
        if (!profileResponse.ok) {
          setError("无法加载 profile");
          return;
        }
        const profileData = await profileResponse.json();
        const profile = profileData.profile;
        if (!profile) {
          setError("无法加载 profile");
          return;
        }

        setCurrentUser({
          username: profile.display_name || "user",
          role: (profile.role || "fan") as "fan" | "creator",
          avatar: profile.avatar_url || undefined,
        });

        // 检查是否为 creator
        if (profile.role !== "creator") {
          setError("只有 creator 可以发帖");
        }
      } catch (err) {
        console.error("[new-post] checkAuth error", err);
        setError("加载失败，请重试");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUserId) {
      setError("用户未登录");
      return;
    }

    if (!formData.content.trim()) {
      setError("Content 是必填项");
      return;
    }

    // 验证 PPV 价格
    if (formData.visibility === "ppv") {
      const priceValue = parseFloat(formData.price);
      if (!formData.price.trim() || isNaN(priceValue) || priceValue < 1.0) {
        setError("PPV 价格不能低于 $1.00");
        return;
      }
    }

    try {
      setIsSaving(true);
      setError(null);

      const priceCents =
        formData.visibility === "ppv" ? Math.round(parseFloat(formData.price) * 100) : null;

      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title.trim() || undefined,
          content: formData.content.trim(),
          media_url: formData.media_url.trim() || undefined, // 向后兼容
          mediaFiles: mediaFiles.length > 0 ? mediaFiles : undefined, // Phase 2: 多文件
          visibility: formData.visibility,
          priceCents: priceCents,
          previewEnabled: formData.preview_enabled,
          watermarkEnabled: formData.watermark_enabled,
        }),
      });

      const result = await response.json();

      if (result.success && result.postId) {
        // 如果有标签，保存标签
        if (selectedTags.length > 0) {
          try {
            await fetch(`/api/posts/${result.postId}/tags`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tagIds: selectedTags }),
            });
          } catch (tagError) {
            console.error("Failed to save tags:", tagError);
            // 不阻止帖子创建成功，只是标签保存失败
          }
        }

        toast.success("Post 创建成功！");
        setTimeout(() => {
          router.push("/home");
        }, 500);
      } else {
        setError(result.error || "创建失败，请重试");
      }
    } catch (err) {
      console.error("[new-post] handleSubmit error", err);
      setError("创建失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <NavHeader user={currentUser} notificationCount={0} />
        <main className="py-6 sm:py-8 lg:py-12">
          <CenteredContainer maxWidth="2xl">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-48 bg-muted rounded"></div>
              <div className="h-64 bg-muted rounded-xl"></div>
              <div className="h-12 w-full bg-muted rounded-xl"></div>
            </div>
          </CenteredContainer>
        </main>
      </div>
    );
  }

  if (error && currentUser?.role !== "creator") {
    return (
      <div className="min-h-screen bg-background">
        {currentUser && <NavHeader user={currentUser} notificationCount={0} />}
        <main className="py-6 sm:py-8 lg:py-12">
          <CenteredContainer maxWidth="2xl">
            <Card className="p-6 rounded-xl border shadow-sm">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-foreground mb-4">Become a Creator</h1>
                <p className="text-muted-foreground mb-6">
                  只有 creator 可以发帖。请先成为 creator。
                </p>
                <Button
                  onClick={() => router.push("/home")}
                  className="rounded-xl min-h-[44px] transition-all duration-200"
                >
                  返回首页
                </Button>
              </div>
            </Card>
          </CenteredContainer>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {currentUser && <NavHeader user={currentUser} notificationCount={0} />}

      <main className="py-6 sm:py-8 lg:py-12">
        <CenteredContainer maxWidth="2xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-2">Create New Post</h1>
            <p className="text-lg text-muted-foreground">分享你的内容</p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 mb-8">
              <p className="text-destructive font-medium">错误</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
          )}

          <Card className="rounded-xl border shadow-sm p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
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
                  className="min-h-[44px] rounded-xl"
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
                  className="rounded-xl resize-none"
                />
              </div>

              {/* Multi Media Upload */}
              <div className="space-y-2">
                <Label>Media (可选，支持多文件)</Label>
                <MultiMediaUpload
                  onUploadComplete={(files) => {
                    setMediaFiles(files);
                    toast.success(`已上传 ${files.length} 个文件`);
                  }}
                  onUploadError={(error) => {
                    setError(error);
                    toast.error(error);
                  }}
                  maxFiles={10}
                />
                {mediaFiles.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    已上传 {mediaFiles.length} 个文件
                  </p>
                )}
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags (可选，最多 5 个)</Label>
                <TagSelector
                  selectedTags={selectedTags}
                  onTagsChange={setSelectedTags}
                  maxTags={5}
                />
                <p className="text-xs text-muted-foreground">添加标签帮助用户发现你的内容</p>
              </div>

              {/* Visibility */}
              <div className="space-y-3">
                <Label>Visibility</Label>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      value="free"
                      checked={formData.visibility === "free"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          visibility: e.target.value as PostVisibility,
                          price: "",
                        })
                      }
                      disabled={isSaving}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Free - 所有人可见</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      value="subscribers"
                      checked={formData.visibility === "subscribers"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          visibility: e.target.value as PostVisibility,
                          price: "",
                        })
                      }
                      disabled={isSaving}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Subscribers-only - 仅订阅者可见</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      value="ppv"
                      checked={formData.visibility === "ppv"}
                      onChange={(e) =>
                        setFormData({ ...formData, visibility: e.target.value as PostVisibility })
                      }
                      disabled={isSaving}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Pay-per-post - 需要单独解锁</span>
                  </label>
                </div>
              </div>

              {/* Price (only for PPV) */}
              {formData.visibility === "ppv" && (
                <div className="space-y-2">
                  <Label htmlFor="price">
                    Price (USD) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    disabled={isSaving}
                    required
                    className="min-h-[44px] rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">设置解锁此 post 的价格（美元）</p>
                </div>
              )}

              {/* Preview Enabled (for videos) */}
              {mediaFiles.some((f) => f.type === "video") && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="preview_enabled">Enable Preview (视频前 10 秒)</Label>
                    <p className="text-sm text-muted-foreground">允许未订阅用户预览视频前 10 秒</p>
                  </div>
                  <Switch
                    id="preview_enabled"
                    checked={formData.preview_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, preview_enabled: checked })
                    }
                    disabled={isSaving}
                  />
                </div>
              )}

              {/* Watermark Enabled (for images) */}
              {mediaFiles.some((f) => f.type === "image") && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="watermark_enabled">Enable Watermark (图片左上角)</Label>
                    <p className="text-sm text-muted-foreground">
                      为图片添加水印（仅图片，Creator 可开关）
                    </p>
                  </div>
                  <Switch
                    id="watermark_enabled"
                    checked={formData.watermark_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, watermark_enabled: checked })
                    }
                    disabled={isSaving}
                  />
                </div>
              )}

              {/* Submit Button */}
              <div className="flex gap-4 pt-6 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/home")}
                  disabled={isSaving}
                  className="flex-1 rounded-xl min-h-[44px] transition-all duration-200"
                  aria-label="Cancel post creation"
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 rounded-xl min-h-[44px] transition-all duration-200"
                  aria-label="Publish post"
                >
                  {isSaving ? "发布中..." : "发布"}
                </Button>
              </div>
            </form>
          </Card>
        </CenteredContainer>
      </main>
    </div>
  );
}
