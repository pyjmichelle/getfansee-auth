"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Eye, ArrowLeft, Share2, Copy, Clock, ImageIcon } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { ShareModal } from "@/components/share-modal";
import { DEFAULT_AVATAR_CREATOR } from "@/lib/image-fallbacks";
import { useAuth } from "@/contexts/auth-context";

type PublishSuccessPageClientProps = {
  postType: "free" | "subscribers" | "ppv";
  price: string;
  postId?: string;
};

export default function PublishSuccessPageClient({
  postType,
  price,
  postId,
}: PublishSuccessPageClientProps) {
  const router = useRouter();
  const auth = useAuth();
  const [copied, setCopied] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const username = auth.profile?.display_name || auth.user?.email?.split("@")[0] || "you";
  const avatar = auth.profile?.avatar_url || DEFAULT_AVATAR_CREATOR;
  const currentUser = { username, role: "creator" as const, avatar };

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || "https://getfansee.com";
  const postUrl = postId ? `${baseUrl}/posts/${postId}` : `${baseUrl}/creator/studio`;

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
            <h1 className="text-h1 mb-3 text-text-primary">Post Published!</h1>
            <p className="text-text-secondary text-body">
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
                  <p className="text-tiny text-text-tertiary flex items-center gap-1">
                    <Clock size={10} aria-hidden="true" />
                    Just now
                  </p>
                </div>
              </div>
              <p className="text-text-secondary text-small line-clamp-2 mb-4">
                Your new {getPostTypeLabel().toLowerCase()} has been published successfully…
              </p>
              <div className="aspect-video bg-surface-raised rounded-xl flex items-center justify-center border border-border-base">
                <ImageIcon size={40} className="text-text-quaternary" aria-hidden="true" />
              </div>
            </div>

            {/* Share Section */}
            <div className="card-block p-5" role="region" aria-label="Share your post">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 bg-[var(--wine-tint)] rounded-xl flex items-center justify-center shrink-0">
                  <Share2 size={16} className="text-wine-text" aria-hidden="true" />
                </div>
                <h2 className="font-bold text-text-primary">Share your post</h2>
              </div>

              {/* Copy Link */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={postUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-surface-raised border border-border-base rounded-xl text-tiny text-text-primary truncate focus:outline-none focus:border-[var(--wine)]/50"
                  aria-label="Post URL"
                />
                <Button
                  onClick={handleCopyLink}
                  type="button"
                  size="sm"
                  className="min-h-[40px] flex items-center gap-1.5"
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
              <Button
                type="button"
                variant="outline"
                className="w-full py-2.5 text-small min-h-[44px] flex items-center justify-center gap-1.5"
                onClick={() => setShareModalOpen(true)}
                aria-label="Share your post"
              >
                <Share2 size={14} aria-hidden="true" />
                Share to social
              </Button>
            </div>
          </div>

          {/* Action Buttons — Mobile: full-width stacked; Desktop: side-by-side */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <Button
              onClick={() => router.push(postId ? `/posts/${postId}` : "/creator/studio")}
              className="flex-1 min-h-[48px]"
              aria-label="View your published post"
            >
              <Eye className="w-5 h-5 mr-2" aria-hidden="true" />
              View Post
            </Button>
            <Button asChild variant="outline" className="flex-1 min-h-[48px]">
              <Link href="/creator/new-post" aria-label="Create another post">
                Create Another
              </Link>
            </Button>
          </div>

          {/* Back link */}
          <div className="text-center">
            <Link
              href="/creator/studio"
              className="text-text-tertiary hover:text-wine-text transition-colors inline-flex items-center gap-1.5 text-small focus-visible:outline-2 focus-visible:outline-[var(--wine)]"
              aria-label="Return to Creator Studio dashboard"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Back to Creator Studio
            </Link>
          </div>
        </div>
      </div>

      <ShareModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        url={postUrl}
        title="Check out my new post on GetFanSee"
        sheetTitle="Share your post"
      />
    </PageShell>
  );
}
