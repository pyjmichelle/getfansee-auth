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
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { BottomNavigation } from "@/components/bottom-navigation";

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
          setError("Unable to load profile");
          return;
        }
        const profileData = await profileResponse.json();
        const profile = profileData.profile;
        if (!profile) {
          setError("Unable to load profile");
          return;
        }

        setCurrentUser({
          username: profile.display_name || "user",
          role: (profile.role || "fan") as "fan" | "creator",
          avatar: profile.avatar_url || undefined,
        });

        // 检查是否为 creator
        if (profile.role !== "creator") {
          setError("Only creators can post");
        }
      } catch (err) {
        console.error("[new-post] checkAuth error", err);
        setError("Failed to load, please try again");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUserId) {
      setError("User not logged in");
      return;
    }

    if (!formData.content.trim()) {
      setError("Content is required");
      return;
    }

    // 验证 PPV 价格
    if (formData.visibility === "ppv") {
      const priceValue = parseFloat(formData.price);
      if (!formData.price.trim() || isNaN(priceValue) || priceValue < 1.0) {
        setError("PPV price must be at least $1.00");
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

        toast.success("Post created successfully!");
        setTimeout(() => {
          router.push("/home");
        }, 500);
      } else {
        setError(result.error || "Failed to create, please try again");
      }
    } catch (err) {
      console.error("[new-post] handleSubmit error", err);
      setError("Failed to create, please try again");
    } finally {
      setIsSaving(false);
    }
  };

  // Show minimal loading state during auth check - don't render any components that make API calls
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <LoadingState type="spinner" text="Loading…" />
      </div>
    );
  }

  if (error && currentUser?.role !== "creator") {
    return (
      <div className="min-h-screen bg-background">
        {currentUser && <NavHeader user={currentUser!} notificationCount={0} />}
        <main className="py-6 sm:py-8 lg:py-12">
          <CenteredContainer maxWidth="2xl">
            <Card className="p-6 rounded-xl border shadow-sm">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-foreground mb-4">Become a Creator</h1>
                <p className="text-muted-foreground mb-6">
                  Only creators can post. Please become a creator first.
                </p>
                <Button
                  onClick={() => router.push("/home")}
                  className="rounded-xl min-h-[44px] transition-[transform,opacity] duration-200 motion-safe:transition-[transform,opacity] motion-reduce:transition-none"
                >
                  Back to Home
                </Button>
              </div>
            </Card>
          </CenteredContainer>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0" data-testid="page-ready">
      {currentUser && <NavHeader user={currentUser!} notificationCount={0} />}

      <main className="py-6 sm:py-8 lg:py-12">
        <CenteredContainer maxWidth="2xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-2">Create New Post</h1>
            <p className="text-lg text-muted-foreground">Share your content with your audience</p>
          </div>

          {error && <ErrorState title="Error" message={error} variant="inline" className="mb-8" />}

          <Card className="rounded-xl border shadow-sm p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title (optional)</Label>
                <Input
                  id="title"
                  type="text"
                  placeholder="Post title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  disabled={isSaving}
                  className="min-h-[44px] rounded-xl"
                  data-testid="post-title"
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
                  data-testid="post-content"
                />
              </div>

              {/* Multi Media Upload */}
              <div className="space-y-2" data-testid="upload-zone">
                <Label>Media (optional, multiple files supported)</Label>
                <MultiMediaUpload
                  onUploadComplete={(files) => {
                    setMediaFiles(files);
                    toast.success(`Uploaded ${files.length} file(s)`);
                  }}
                  onUploadError={(error) => {
                    setError(error);
                    toast.error(error);
                  }}
                  maxFiles={10}
                />
                {mediaFiles.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {mediaFiles.length} file(s) uploaded
                  </p>
                )}
              </div>

              {/* Tags - Only render after auth is complete and user is creator */}
              {!isLoading && currentUser?.role === "creator" && (
                <div className="space-y-2">
                  <Label>Tags (optional, up to 5)</Label>
                  <TagSelector
                    category="content"
                    selectedTags={selectedTags}
                    onChange={setSelectedTags}
                    maxTags={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    Add tags to help users discover your content
                  </p>
                </div>
              )}

              {/* Visibility */}
              <div className="space-y-3" data-testid="visibility-toggle">
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
                    <span className="text-sm">Free - Public content visible to everyone</span>
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
                    <span className="text-sm">
                      Subscribers-only - Exclusive content for your fans
                    </span>
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
                    <span className="text-sm">Pay-per-view - Fans pay to unlock each post</span>
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
                    data-testid="price-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Set the price fans pay to unlock this exclusive content (USD)
                  </p>
                </div>
              )}

              {/* Preview Enabled (for videos) */}
              {mediaFiles.some((f) => f.type === "video") && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="preview_enabled">Enable Preview (first 10 seconds)</Label>
                    <p className="text-sm text-muted-foreground">
                      Give fans a teaser - let them preview the first 10 seconds
                    </p>
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
                    <Label htmlFor="watermark_enabled">Enable Watermark (top-left corner)</Label>
                    <p className="text-sm text-muted-foreground">
                      Protect your content with a watermark on images
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
                  className="flex-1 rounded-xl min-h-[44px] transition-[transform,opacity] duration-200 motion-safe:transition-[transform,opacity] motion-reduce:transition-none"
                  aria-label="Cancel post creation"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 rounded-xl min-h-[44px] transition-[transform,opacity] duration-200 motion-safe:transition-[transform,opacity] motion-reduce:transition-none"
                  aria-label="Publish post"
                  data-testid="submit-button"
                >
                  {isSaving ? "Publishing…" : "Publish"}
                </Button>
              </div>
            </form>
          </Card>
        </CenteredContainer>
      </main>

      <BottomNavigation notificationCount={0} userRole={currentUser?.role} />
    </div>
  );
}
