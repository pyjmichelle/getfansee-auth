"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { type PostVisibility } from "@/lib/types";
import { toast } from "sonner";
import { MultiMediaUpload } from "@/components/multi-media-upload";
import { TagSelector } from "@/components/tag-selector";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { type MediaFile } from "@/lib/storage";
import { Analytics } from "@/lib/analytics";
import {
  ArrowLeft,
  Edit3,
  Image,
  Hash,
  Eye,
  Users,
  Lock,
  Globe,
  Info,
  Calendar,
  Send,
  Loader2,
} from "@/lib/icons";
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
        Analytics.postCreated(formData.visibility, mediaFiles.length > 0);
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

  // Show minimal loading state during auth check
  if (isLoading) {
    return (
      <PageShell user={currentUser} notificationCount={0} maxWidth="5xl">
        <div className="pb-12 space-y-6 animate-pulse">
          <div className="h-10 w-64 bg-surface-raised rounded" />
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <div className="h-64 bg-surface-raised rounded-2xl" />
              <div className="h-48 bg-surface-raised rounded-2xl" />
            </div>
            <div className="h-96 bg-surface-raised rounded-2xl" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (error && currentUser?.role !== "creator") {
    return (
      <PageShell user={currentUser} notificationCount={0} maxWidth="5xl">
        <div className="pb-12">
          <div className="bg-surface-raised border border-border-base rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock size={32} className="text-brand-primary" />
            </div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">Become a Creator</h1>
            <p className="text-text-tertiary mb-6">
              Only creators can post. Please become a creator first.
            </p>
            <Button
              onClick={() => router.push("/home")}
              className="px-6 py-3 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary/90 transition-all shadow-glow active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              Back to Home
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  const visibilityOptions = [
    {
      value: "free" as const,
      icon: Globe,
      label: "Free",
      description: "Everyone can see this post",
      color: "text-success",
    },
    {
      value: "subscribers" as const,
      icon: Users,
      label: "Subscribers Only",
      description: "Only your subscribers can view",
      color: "text-brand-primary",
    },
    {
      value: "ppv" as const,
      icon: Lock,
      label: "Pay Per View",
      description: "One-time unlock for specific price",
      color: "text-brand-accent",
    },
  ];

  const canPublish =
    formData.content.trim().length > 0 &&
    (formData.visibility !== "ppv" || (formData.price && parseFloat(formData.price) > 0));
  const handleDiscardAndExit = () => router.push("/creator/studio");

  return (
    <PageShell user={currentUser} notificationCount={0} maxWidth="5xl">
      <div data-testid="page-ready" className="pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/creator/studio"
              className="p-2.5 hover:bg-surface-raised rounded-xl transition-colors active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
              aria-label="Back to Studio"
            >
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-3xl font-bold mb-1 text-text-primary">Create New Post</h1>
              <p className="text-text-tertiary text-sm">Share your content with your audience</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-surface-raised border border-border-base rounded-xl font-semibold hover:bg-surface-overlay transition-all flex items-center gap-2 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  Discard & Exit
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Discard this post draft?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You have unsaved changes. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep editing</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDiscardAndExit}>
                    Discard & Exit
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              onClick={handleSubmit}
              disabled={!canPublish || isSaving}
              variant="gradient"
              className="px-6 py-2.5 text-white rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-glow flex items-center gap-2 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
              data-testid="submit-button"
            >
              {isSaving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Publish
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-xl flex items-center gap-3">
            <Info size={20} className="text-error flex-shrink-0" />
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {/* Main Content */}
        <form onSubmit={handleSubmit}>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Left Column - Content */}
            <div className="md:col-span-2 space-y-6">
              {/* Post Title */}
              <div className="card-block p-6">
                <label className="font-semibold flex items-center gap-2 mb-4">
                  <Edit3 size={18} className="text-brand-primary" />
                  Title (optional)
                </label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Give your post a title..."
                  maxLength={200}
                  disabled={isSaving}
                  className="w-full px-4 py-3 bg-surface-base border border-border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all text-text-primary placeholder:text-text-quaternary"
                  data-testid="post-title"
                />
              </div>

              {/* Content Textarea */}
              <div className="card-block p-6">
                <div className="flex items-center justify-between mb-4">
                  <label className="font-semibold flex items-center gap-2">
                    <Edit3 size={18} className="text-brand-primary" />
                    Post Content
                  </label>
                  <span className="text-sm text-text-tertiary">{formData.content.length}/5000</span>
                </div>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="What do you want to share with your fans? Share your thoughts, updates, or exclusive content..."
                  rows={10}
                  maxLength={5000}
                  disabled={isSaving}
                  className="w-full px-4 py-3 bg-surface-base border border-border-subtle rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all resize-none text-text-primary placeholder:text-text-quaternary"
                  data-testid="post-content"
                />
                <div className="flex items-center gap-4 mt-3 text-sm text-text-tertiary">
                  <div className="flex items-center gap-1.5">
                    <span>Markdown supported</span>
                  </div>
                </div>
              </div>

              {/* Media Upload */}
              <div className="card-block p-6" data-testid="upload-zone">
                <label className="font-semibold flex items-center gap-2 mb-4">
                  <Image size={18} className="text-brand-primary" />
                  Media Attachments
                </label>
                <MultiMediaUpload
                  onUploadComplete={(files) => {
                    setMediaFiles(files);
                    toast.success(`Uploaded ${files.length} file(s)`);
                  }}
                  onUploadError={(uploadError) => {
                    setError(uploadError);
                    toast.error(uploadError);
                  }}
                  maxFiles={10}
                />
                {mediaFiles.length > 0 && (
                  <p className="text-sm text-text-tertiary mt-3">
                    {mediaFiles.length} file(s) uploaded
                  </p>
                )}
              </div>

              {/* Tags */}
              {!isLoading && currentUser?.role === "creator" && (
                <div className="card-block p-6">
                  <label className="font-semibold flex items-center gap-2 mb-4">
                    <Hash size={18} className="text-brand-primary" />
                    Tags
                  </label>
                  <TagSelector
                    category="content"
                    selectedTags={selectedTags}
                    onChange={setSelectedTags}
                    maxTags={5}
                  />
                  <p className="text-sm text-text-tertiary flex items-center gap-2 mt-3">
                    <Info size={14} />
                    {selectedTags.length}/5 tags • Add tags to help users discover your content
                  </p>
                </div>
              )}
            </div>

            {/* Right Column - Settings */}
            <div className="space-y-6">
              {/* Visibility Settings */}
              <div className="card-block p-6 sticky top-24" data-testid="visibility-toggle">
                <label className="font-semibold flex items-center gap-2 mb-4">
                  <Eye size={18} className="text-brand-primary" />
                  Post Visibility
                </label>

                <div className="space-y-3">
                  {visibilityOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        formData.visibility === option.value
                          ? "border-brand-primary shadow-glow bg-brand-primary-alpha-10"
                          : "border-border-subtle hover:border-border-base bg-surface-base"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="visibility"
                          checked={formData.visibility === option.value}
                          onChange={() =>
                            setFormData({
                              ...formData,
                              visibility: option.value,
                              price: option.value === "ppv" ? formData.price : "",
                            })
                          }
                          disabled={isSaving}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <option.icon size={18} className={option.color} />
                            <span className="font-semibold text-text-primary">{option.label}</span>
                          </div>
                          <p className="text-sm text-text-tertiary">{option.description}</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Price Input for PPV */}
                {formData.visibility === "ppv" && (
                  <div className="mt-4 pt-4 border-t border-border-subtle">
                    <label className="block mb-2 text-sm font-semibold">Set Price</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary font-semibold">
                        $
                      </span>
                      <Input
                        id="price"
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="0.00"
                        min="0.99"
                        step="0.01"
                        disabled={isSaving}
                        className="w-full pl-9 pr-4 py-3 bg-surface-base border border-border-base rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all"
                        data-testid="price-input"
                      />
                    </div>
                    <p className="text-xs text-text-tertiary mt-2 flex items-center gap-1">
                      <Info size={12} />
                      Minimum: $0.99 • Platform fee: 20%
                    </p>

                    {/* Price Suggestions */}
                    <div className="flex gap-2 mt-3">
                      {["2.99", "4.99", "9.99", "19.99"].map((suggested) => (
                        <button
                          key={suggested}
                          type="button"
                          onClick={() => setFormData({ ...formData, price: suggested })}
                          className="flex-1 px-3 py-2 bg-surface-base border border-border-base rounded-lg text-sm font-semibold hover:bg-brand-primary/10 hover:border-brand-primary/30 transition-all"
                        >
                          ${suggested}
                        </button>
                      ))}
                    </div>

                    {/* Earnings Preview */}
                    {formData.price && parseFloat(formData.price) >= 0.99 && (
                      <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-xl">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-text-tertiary">You&apos;ll earn:</span>
                          <span className="font-bold text-success">
                            ${(parseFloat(formData.price) * 0.8).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Preview/Watermark Options */}
              {(mediaFiles.some((f) => f.type === "video") ||
                mediaFiles.some((f) => f.type === "image")) && (
                <div className="card-block p-6">
                  <label className="font-semibold flex items-center gap-2 mb-4">
                    <Calendar size={18} className="text-brand-primary" />
                    Media Options
                  </label>

                  {/* Preview Enabled (for videos) */}
                  {mediaFiles.some((f) => f.type === "video") && (
                    <div className="flex items-center justify-between p-3 bg-surface-base border border-border-base rounded-xl mb-3">
                      <div className="flex-1">
                        <Label htmlFor="preview_enabled" className="text-sm font-semibold">
                          Enable Preview
                        </Label>
                        <p className="text-xs text-text-tertiary">First 10 seconds teaser</p>
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
                    <div className="flex items-center justify-between p-3 bg-surface-base border border-border-base rounded-xl">
                      <div className="flex-1">
                        <Label htmlFor="watermark_enabled" className="text-sm font-semibold">
                          Enable Watermark
                        </Label>
                        <p className="text-xs text-text-tertiary">Protect your images</p>
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
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Mobile Action Buttons */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-surface-base border-t border-border-base flex gap-3 z-50">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                className="flex-1 py-3 bg-surface-raised border border-border-base rounded-xl font-semibold hover:bg-surface-overlay transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                Discard & Exit
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Discard this post draft?</AlertDialogTitle>
                <AlertDialogDescription>
                  You have unsaved changes. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep editing</AlertDialogCancel>
                <AlertDialogAction onClick={handleDiscardAndExit}>Discard & Exit</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            onClick={handleSubmit}
            disabled={!canPublish || isSaving}
            variant="gradient"
            className="flex-1 py-3 text-white rounded-xl font-semibold disabled:opacity-40 shadow-glow active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary disabled:shadow-none"
            data-testid="submit-button-mobile"
          >
            {isSaving ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
