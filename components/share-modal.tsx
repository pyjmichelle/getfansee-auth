"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Check, Copy } from "@/lib/icons";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/use-mobile";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  url: string;
  /** Short title used for platforms that accept a text param (e.g. X, Telegram, WhatsApp). */
  title?: string;
  /**
   * Full share message to pass as the text body to platforms that support it.
   * When set, this overrides `title` for Telegram / WhatsApp.
   * Should already include the URL so recipients can click it directly.
   */
  shareText?: string;
  /** Custom header title shown inside the sheet. Defaults to "Share this post". */
  sheetTitle?: string;
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

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
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
  /** Whether to open a URL or copy to clipboard. */
  getAction: (url: string, title: string) => "open" | "copy";
  /** Generate the share URL. When useShareText=true, the full shareText replaces title. */
  getUrl?: (url: string, text: string) => string;
  /** useShareText: if true, pass full shareText (instead of title) to getUrl. */
  useShareText?: boolean;
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
    useShareText: true,
    // X: text param only (URL embedded in shareText already), capped at ~280 chars by Twitter UI
    getUrl: (_url, text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
  },
  {
    id: "telegram",
    label: "Telegram",
    icon: TelegramIcon,
    color: "text-white",
    bgColor: "bg-[#26A5E4]",
    getAction: () => "open",
    useShareText: true,
    // Telegram: url param for link preview + text param for message body
    getUrl: (url, text) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: WhatsAppIcon,
    color: "text-white",
    bgColor: "bg-[#25D366]",
    getAction: () => "open",
    useShareText: true,
    // WhatsApp: single text param containing the full message (URL included)
    getUrl: (_url, text) => `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
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

export function ShareModal({
  open,
  onClose,
  url,
  title = "",
  shareText,
  sheetTitle = "Share this post",
}: ShareModalProps) {
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);
  // Mobile: bottom sheet. Desktop: centered dialog — previously this modal
  // only had a mobile Sheet implementation, so on PC it rendered as a
  // full-width bar pinned to the bottom of the entire viewport (F-004).
  const isMobile = useMediaQuery("(max-width: 767px)");

  const handlePlatformClick = async (platform: SharePlatform) => {
    const action = platform.getAction(url, title);

    if (action === "open" && platform.getUrl) {
      // Prefer full shareText for platforms that support rich text bodies
      const textArg = platform.useShareText && shareText ? shareText : title;
      window.open(platform.getUrl(url, textArg), "_blank", "noopener,noreferrer");
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

  const platformGrid = (
    <div className="grid grid-cols-4 gap-3 mb-5">
      {PLATFORMS.map((platform) => {
        const Icon = platform.icon;
        const isCopied = copiedPlatform === platform.id;
        return (
          <button
            key={platform.id}
            onClick={() => handlePlatformClick(platform)}
            className="flex flex-col items-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--wine)] focus-visible:rounded-xl"
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
            <span className="text-tiny text-text-muted text-center leading-tight whitespace-nowrap">
              {platform.id === "x" ? "X" : platform.label.split(" ")[0]}
            </span>
          </button>
        );
      })}
    </div>
  );

  const copyLinkRow = (
    <button
      onClick={handleCopyLink}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-raised hover:bg-surface-overlay transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--wine)]"
    >
      <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center shrink-0">
        {copiedPlatform === "copy" ? (
          <Check className="w-4 h-4 text-[var(--success)]" aria-hidden="true" />
        ) : (
          <Copy className="w-4 h-4 text-text-secondary" aria-hidden="true" />
        )}
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-small font-medium text-text-primary">
          {copiedPlatform === "copy" ? "Copied!" : "Copy Link"}
        </p>
        <p className="text-tiny text-text-muted truncate">{url}</p>
      </div>
    </button>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side="bottom"
          className="h-auto max-h-[90vh] rounded-t-2xl bg-surface-base border-t border-border-base p-0 overflow-hidden"
        >
          <div className="flex justify-center py-3" aria-hidden="true">
            <div className="w-10 h-1 rounded-full bg-border-strong" />
          </div>

          <SheetHeader className="px-4 pb-4">
            <SheetTitle className="text-body font-semibold text-text-primary">
              {sheetTitle}
            </SheetTitle>
          </SheetHeader>

          <div className="px-4 pb-2">
            {platformGrid}
            {copyLinkRow}
          </div>

          <div className="h-5 safe-area-bottom" />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm p-5">
        <DialogHeader>
          <DialogTitle className="text-body font-semibold text-text-primary">
            {sheetTitle}
          </DialogTitle>
        </DialogHeader>
        {platformGrid}
        {copyLinkRow}
      </DialogContent>
    </Dialog>
  );
}
