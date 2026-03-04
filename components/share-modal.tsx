"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Check, Copy } from "@/lib/icons";
import { toast } from "sonner";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  url: string;
  title?: string;
}

/* -------------------------------------------------------------------------- */
/* Brand SVG icons (inline, no external dep)                                   */
/* -------------------------------------------------------------------------- */

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.733-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function OnlyFansIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4.8a7.2 7.2 0 110 14.4A7.2 7.2 0 0112 4.8zm0 2.4a4.8 4.8 0 100 9.6 4.8 4.8 0 000-9.6z" />
    </svg>
  );
}

function FanslyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.5 8.5l-2.25 7h-1.75l-1.5-4.5-1.5 4.5H8.75l-2.25-7h1.75l1.375 4.625L11 8.5h2l1.375 4.625L15.75 8.5H17.5z" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Platform configs                                                            */
/* -------------------------------------------------------------------------- */

interface SharePlatform {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  getAction: (url: string, title: string) => "open" | "copy";
  getUrl?: (url: string, title: string) => string;
  copyMessage?: string;
}

const PLATFORMS: SharePlatform[] = [
  {
    id: "x",
    label: "X (Twitter)",
    icon: XIcon,
    color: "text-white",
    bgColor: "bg-black",
    getAction: () => "open",
    getUrl: (url, title) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title || "")}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: FacebookIcon,
    color: "text-white",
    bgColor: "bg-[#1877F2]",
    getAction: () => "open",
    getUrl: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: "instagram",
    label: "Instagram",
    icon: InstagramIcon,
    color: "text-white",
    bgColor: "bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCAF45]",
    getAction: () => "copy",
    copyMessage: "Link copied! Paste it on Instagram to share.",
  },
  {
    id: "onlyfans",
    label: "OnlyFans",
    icon: OnlyFansIcon,
    color: "text-white",
    bgColor: "bg-[#00AFF0]",
    getAction: () => "copy",
    copyMessage: "Link copied! Paste it on OnlyFans to share.",
  },
  {
    id: "fansly",
    label: "Fansly",
    icon: FanslyIcon,
    color: "text-white",
    bgColor: "bg-[#1DA1F2]",
    getAction: () => "copy",
    copyMessage: "Link copied! Paste it on Fansly to share.",
  },
];

/* -------------------------------------------------------------------------- */
/* ShareModal                                                                  */
/* -------------------------------------------------------------------------- */

export function ShareModal({ open, onClose, url, title = "" }: ShareModalProps) {
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);

  const handlePlatformClick = async (platform: SharePlatform) => {
    const action = platform.getAction(url, title);

    if (action === "open" && platform.getUrl) {
      window.open(platform.getUrl(url, title), "_blank", "noopener,noreferrer");
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopiedPlatform(platform.id);
        setTimeout(() => setCopiedPlatform(null), 2000);
        toast.success(platform.copyMessage || "Link copied!");
      } catch {
        toast.error("Failed to copy link");
      }
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPlatform("copy");
      setTimeout(() => setCopiedPlatform(null), 2000);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="h-auto max-h-[90vh] rounded-t-2xl bg-surface-base border-t border-border-base p-0 overflow-hidden"
      >
        {/* Handle */}
        <div className="flex justify-center py-3" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-border-strong" />
        </div>

        {/* Header */}
        <SheetHeader className="px-4 pb-4">
          <SheetTitle className="text-[15px] font-semibold text-text-primary">
            Share this post
          </SheetTitle>
        </SheetHeader>

        {/* Platform grid */}
        <div className="px-4 pb-2">
          <div className="grid grid-cols-5 gap-3 mb-5">
            {PLATFORMS.map((platform) => {
              const Icon = platform.icon;
              const isCopied = copiedPlatform === platform.id;
              return (
                <button
                  key={platform.id}
                  onClick={() => handlePlatformClick(platform)}
                  className="flex flex-col items-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-violet-500 focus-visible:rounded-xl"
                  aria-label={`Share to ${platform.label}`}
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform active:scale-90",
                      platform.bgColor,
                      platform.color
                    )}
                  >
                    {isCopied ? (
                      <Check className="w-5 h-5" aria-hidden="true" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className="text-[11px] text-text-muted text-center leading-tight whitespace-nowrap">
                    {platform.id === "x" ? "X" : platform.label.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Copy link row */}
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-raised hover:bg-surface-overlay transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-violet-500"
          >
            <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center shrink-0">
              {copiedPlatform === "copy" ? (
                <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              ) : (
                <Copy className="w-4 h-4 text-text-secondary" aria-hidden="true" />
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="text-[13px] font-medium text-text-primary">
                {copiedPlatform === "copy" ? "Copied!" : "Copy Link"}
              </p>
              <p className="text-[11px] text-text-muted truncate">{url}</p>
            </div>
          </button>
        </div>

        <div className="h-5 safe-area-bottom" />
      </SheetContent>
    </Sheet>
  );
}
