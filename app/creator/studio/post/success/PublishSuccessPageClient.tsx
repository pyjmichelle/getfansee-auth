"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Eye, ArrowLeft, Share2, Copy, Clock, Image } from "lucide-react";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type PublishSuccessPageClientProps = {
  postType: "free" | "subscribers" | "ppv";
  price: string;
};

export default function PublishSuccessPageClient({
  postType,
  price,
}: PublishSuccessPageClientProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const currentUser = {
    username: "sophia_creative",
    role: "creator" as const,
    avatar: "/creator-avatar.png",
  };

  // Mock post ID for demonstration
  const postId = "demo-post-" + Date.now();
  const postUrl = `https://getfansee.com/post/${postId}`;

  useEffect(() => {
    const timer = setTimeout(() => {
      // 可在此处触发动画或埋点
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(postUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPostTypeLabel = () => {
    if (postType === "free") return "Free Post";
    if (postType === "subscribers") return "Exclusive Post";
    return `Premium Post ($${price})`;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center animate-scale-in">
        {/* Success Animation */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-28 h-28 bg-gradient-subtle rounded-full flex items-center justify-center shadow-xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-success/20 to-success/5" />
              <CheckCircle size={56} className="text-success relative z-10" />
            </div>
            <div className="absolute inset-0 bg-success/20 rounded-full animate-ping" />
          </div>
        </div>

        {/* Success Message */}
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-text-primary">
          Post Published! 🎉
        </h1>
        <p className="text-text-secondary text-lg mb-10">
          Your {getPostTypeLabel().toLowerCase()} is now live and visible to your audience
        </p>

        {/* Post Preview Card */}
        <div className="bg-surface-base border border-border-base rounded-2xl p-6 mb-8 text-left hover:border-brand-primary/30 transition-all">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-subtle">
              <img
                src={currentUser.avatar || "/placeholder.svg"}
                alt="Your avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="font-semibold text-lg text-text-primary">{currentUser.username}</div>
              <div className="text-sm text-text-tertiary flex items-center gap-2">
                <Clock size={12} />
                Just now
              </div>
            </div>
          </div>

          <p className="text-text-secondary line-clamp-3 mb-5">
            Your new {getPostTypeLabel().toLowerCase()} has been published successfully...
          </p>

          <div className="aspect-video bg-surface-raised rounded-xl flex items-center justify-center border border-border-base">
            <Image size={52} className="text-text-quaternary" />
          </div>
        </div>

        {/* Share Section */}
        <div className="bg-gradient-subtle border border-border-base rounded-2xl p-6 md:p-8 mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center">
              <Share2 size={20} className="text-brand-primary" />
            </div>
            <h3 className="font-bold text-lg text-text-primary">Share your post</h3>
          </div>

          <div className="flex gap-3 mb-5">
            <input
              type="text"
              value={postUrl}
              readOnly
              className="flex-1 px-4 py-3 bg-surface-raised border border-border-base rounded-xl text-sm text-text-primary"
            />
            <button
              onClick={handleCopyLink}
              className="px-5 py-3 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary/90 transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-brand-primary/20"
            >
              {copied ? (
                <>
                  <CheckCircle size={18} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={18} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button className="py-3 bg-[#1DA1F2] text-white rounded-xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 active:scale-95">
              <Share2 size={18} />
              Twitter
            </button>
            <button className="py-3 bg-surface-raised border border-border-base text-text-primary rounded-xl font-semibold hover:bg-surface-overlay transition-all flex items-center justify-center gap-2 active:scale-95">
              <Share2 size={18} />
              Share
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Button
            onClick={() =>
              router.push(`/creator/${currentUser.username}?viewAs=fan&postId=${postId}`)
            }
            className="flex-1 py-4 bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/25 active:scale-95"
          >
            <Eye className="w-5 h-5 mr-2" />
            View Post
          </Button>
          <Button
            asChild
            variant="outline"
            className="flex-1 py-4 bg-surface-base border border-border-base rounded-xl font-semibold hover:bg-surface-raised transition-all active:scale-95"
          >
            <Link href="/creator/new-post">Create Another</Link>
          </Button>
        </div>

        <Link
          href="/creator/studio"
          className="text-text-tertiary hover:text-brand-primary transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Back to Creator Studio
        </Link>
      </div>
    </div>
  );
}
