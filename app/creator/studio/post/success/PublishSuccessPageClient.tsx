"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Eye, ArrowLeft, Share2, Copy, Clock, ImageIcon } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { DEFAULT_AVATAR_CREATOR, CREATOR_AVATAR_LEGACY } from "@/lib/image-fallbacks";

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
  const [postId, setPostId] = useState<string | null>(null);
  const currentUser = {
    username: "sophia_creative",
    role: "creator" as const,
    avatar: CREATOR_AVATAR_LEGACY,
  };

  const resolvedPostId = postId ?? "demo-post";
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || "https://getfansee.com";
  const postUrl = `${baseUrl}/posts/${resolvedPostId}`;

  useEffect(() => {
    setPostId(`demo-post-${Date.now()}`);
    const timer = setTimeout(() => {}, 3000);
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
    <PageShell
      user={{ username: currentUser.username, role: currentUser.role, avatar: currentUser.avatar }}
      maxWidth="3xl"
    >
      <div className="flex items-center justify-center py-8">
        <div className="w-full">
          {/* Success header — centered */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-subtle rounded-full flex items-center justify-center shadow-xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-success/20 to-success/5" />
                  <CheckCircle
                    size={48}
                    className="text-success relative z-10"
                    aria-hidden="true"
                  />
                </div>
                <div
                  className="absolute inset-0 bg-success/20 rounded-full animate-ping"
                  aria-hidden="true"
                />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3 text-text-primary">
              Post Published!
            </h1>
            <p className="text-text-secondary text-base md:text-lg">
              Your {getPostTypeLabel().toLowerCase()} is now live and visible to your audience
            </p>
          </div>

          {/* Desktop: side-by-side preview + share; Mobile: stacked */}
          <div className="md:grid md:grid-cols-2 md:gap-6 space-y-4 md:space-y-0 mb-6">
            {/* Preview Card */}
            <div className="card-block hover-bold p-5" role="region" aria-label="Post preview">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-subtle shrink-0">
                  <img
                    src={currentUser.avatar || DEFAULT_AVATAR_CREATOR}
                    alt="Your avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-semibold text-text-primary">{currentUser.username}</p>
                  <p className="text-xs text-text-tertiary flex items-center gap-1">
                    <Clock size={10} aria-hidden="true" />
                    Just now
                  </p>
                </div>
              </div>
              <p className="text-text-secondary text-sm line-clamp-2 mb-4">
                Your new {getPostTypeLabel().toLowerCase()} has been published successfully…
              </p>
              <div className="aspect-video bg-surface-raised rounded-xl flex items-center justify-center border border-border-base">
                <ImageIcon size={40} className="text-text-quaternary" aria-hidden="true" />
              </div>
            </div>

            {/* Share Section */}
            <div className="card-block p-5" role="region" aria-label="Share your post">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 bg-brand-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <Share2 size={16} className="text-brand-primary" aria-hidden="true" />
                </div>
                <h2 className="font-bold text-text-primary">Share your post</h2>
              </div>

              {/* Copy Link */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={postUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-surface-raised border border-border-base rounded-xl text-xs text-text-primary truncate focus:outline-none focus:border-brand-primary/50"
                  aria-label="Post URL"
                />
                <Button
                  onClick={handleCopyLink}
                  type="button"
                  size="sm"
                  className="px-4 py-2 bg-brand-primary text-white text-sm shadow-glow min-h-[40px] flex items-center gap-1.5"
                  aria-label={copied ? "Link copied to clipboard" : "Copy post link to clipboard"}
                >
                  {copied ? (
                    <>
                      <CheckCircle size={14} aria-hidden="true" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} aria-hidden="true" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Social Share */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="py-2.5 text-sm min-h-[44px] flex items-center justify-center gap-1.5"
                  aria-label="Share on Twitter"
                >
                  <Share2 size={14} aria-hidden="true" />
                  Twitter
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="py-2.5 bg-surface-raised border-border-base text-text-primary text-sm min-h-[44px] flex items-center justify-center gap-1.5 hover:bg-surface-overlay"
                  aria-label="Share post via other apps"
                >
                  <Share2 size={14} aria-hidden="true" />
                  Share
                </Button>
              </div>
            </div>
          </div>

          {/* Action Buttons — Mobile: full-width stacked; Desktop: side-by-side */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <Button
              onClick={() =>
                router.push(`/creator/${currentUser.username}?viewAs=fan&postId=${resolvedPostId}`)
              }
              className="flex-1 min-h-[48px] bg-brand-primary text-white rounded-xl font-semibold hover:bg-brand-primary/90 transition-all shadow-glow active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
              aria-label="View your published post"
            >
              <Eye className="w-5 h-5 mr-2" aria-hidden="true" />
              View Post
            </Button>
            <Button
              asChild
              variant="outline"
              className="flex-1 min-h-[48px] bg-surface-base border border-border-base rounded-xl font-semibold hover:bg-surface-raised transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              <Link href="/creator/new-post" aria-label="Create another post">
                Create Another
              </Link>
            </Button>
          </div>

          {/* Back link */}
          <div className="text-center">
            <Link
              href="/creator/studio"
              className="text-text-tertiary hover:text-brand-primary transition-colors inline-flex items-center gap-1.5 text-sm focus-visible:outline-2 focus-visible:outline-brand-primary"
              aria-label="Return to Creator Studio dashboard"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Back to Creator Studio
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
