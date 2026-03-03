"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Heart,
  MessageCircle,
  Share2,
  Lock,
  MoreHorizontal,
  DollarSign,
  CheckCircle2,
} from "@/lib/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { DEFAULT_AVATAR_CREATOR } from "@/lib/image-fallbacks";

interface ContentCardProps {
  creator: {
    id: string;
    name: string;
    username: string;
    avatar?: string;
    subscriptionPrice?: number;
    isVerified?: boolean;
  };
  content: {
    id: string;
    text?: string;
    image?: string;
    isLocked: boolean;
    lockType?: "subscription" | "ppv";
    price?: number;
    likes: number;
    comments: number;
    createdAt: string | Date;
    isLiked?: boolean;
    isExclusive?: boolean;
    isPurchased?: boolean;
  };
  onUnlock?: (id: string) => void;
  onSubscribe?: (creatorId: string) => void;
  onLike?: (id: string) => void;
  onComment?: (id: string) => void;
  onShare?: (id: string) => void;
  onTip?: (id: string) => void;
  onMore?: (id: string) => void;
  className?: string;
}

export function ContentCard({
  creator,
  content,
  onUnlock,
  onSubscribe,
  onLike,
  onComment,
  onShare,
  onTip,
  onMore,
  className,
}: ContentCardProps) {
  const [isLiked, setIsLiked] = useState(content.isLiked ?? false);
  const [likesCount, setLikesCount] = useState(content.likes);
  const [copied, setCopied] = useState(false);

  const handleLike = () => {
    setIsLiked((v) => !v);
    setLikesCount((c) => (isLiked ? c - 1 : c + 1));
    onLike?.(content.id);
  };

  const handleShare = async () => {
    onShare?.(content.id);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const timeAgo = formatDistanceToNow(new Date(content.createdAt), { addSuffix: true });

  return (
    <article
      className={cn(
        "glass-card rounded-[var(--radius-md)] overflow-hidden",
        "border border-white/6",
        className
      )}
    >
      {/* Creator header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Link href={`/creator/${creator.id}`} className="shrink-0">
          <Avatar className="size-8 ring-1 ring-white/10 hover:ring-violet-500/30 transition-[box-shadow] duration-150">
            <AvatarImage src={creator.avatar || DEFAULT_AVATAR_CREATOR} alt={creator.name} />
            <AvatarFallback className="text-[12px] font-bold">
              {(creator.name?.[0] || "C").toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <Link
              href={`/creator/${creator.id}`}
              className="text-[13px] font-semibold text-white hover:text-violet-400 transition-colors duration-150 truncate"
            >
              {creator.name}
            </Link>
            {creator.isVerified && <CheckCircle2 className="size-[12px] text-amber-400 shrink-0" />}
          </div>
          <p className="text-[11px] text-text-muted">
            @{creator.username} · {timeAgo}
          </p>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5">
          {content.isExclusive && (
            <Badge variant="purple" className="text-[10px] badge-exclusive">
              Exclusive
            </Badge>
          )}
          {content.isPurchased && (
            <Badge variant="gold" className="text-[10px]">
              Purchased
            </Badge>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon-xs"
          className="text-text-muted hover:text-white shrink-0"
          onClick={() => onMore?.(content.id)}
          aria-label="More options"
        >
          <MoreHorizontal className="size-[16px]" />
        </Button>
      </div>

      {/* Caption */}
      {content.text && (
        <div className="px-3 pb-2 text-[13px] text-text-secondary leading-relaxed">
          {content.text}
        </div>
      )}

      {/* Media */}
      {content.image && (
        <Link href={`/posts/${content.id}`} className="block">
          <div className="relative overflow-hidden bg-black aspect-post-portrait">
            <Image
              src={content.image}
              alt="Post content"
              fill
              className={cn(
                "object-cover transition-all duration-300",
                content.isLocked && "blur-locked"
              )}
            />

            {/* Lock overlay */}
            {content.isLocked && (
              <div className="lock-overlay">
                {/* Lock icon */}
                <div className="size-12 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shadow-glow-gold mb-3">
                  <Lock className="size-5 text-amber-400" />
                </div>

                {content.lockType === "ppv" ? (
                  <>
                    <p className="text-[13px] font-medium text-white mb-1">Unlock this post</p>
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        onUnlock?.(content.id);
                      }}
                      className="mt-1"
                    >
                      Unlock for ${content.price?.toFixed(2)}
                    </Button>
                    {creator.subscriptionPrice && (
                      <button
                        className="text-[11px] text-white/50 mt-2 hover:text-white/70 transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          onSubscribe?.(creator.id);
                        }}
                      >
                        or Subscribe for ${creator.subscriptionPrice.toFixed(2)}/mo
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[13px] font-medium text-white mb-1">Subscribe to unlock</p>
                    <Button
                      variant="violet"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        onSubscribe?.(creator.id);
                      }}
                      className="mt-1 shadow-glow-violet"
                    >
                      Subscribe for ${creator.subscriptionPrice?.toFixed(2)}/mo
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </Link>
      )}

      {/* Actions bar */}
      <div className="flex items-center gap-0.5 px-2.5 py-2 border-t border-white/4">
        {/* Like */}
        <button
          onClick={handleLike}
          className={cn(
            "flex items-center gap-1 px-2 py-1.5 rounded-[var(--radius-xs)]",
            "text-[12px] transition-[color,background-color] duration-100",
            "active:scale-95",
            isLiked
              ? "text-violet-500"
              : "text-text-muted hover:text-violet-400 hover:bg-violet-500/5"
          )}
          aria-label={isLiked ? "Unlike" : "Like"}
        >
          <Heart className={cn("size-[16px]", isLiked && "fill-current animate-like-pop")} />
          {likesCount > 0 && <span className="font-medium">{likesCount.toLocaleString()}</span>}
        </button>

        {/* Comment */}
        <Link
          href={`/posts/${content.id}#comments`}
          className={cn(
            "flex items-center gap-1 px-2 py-1.5 rounded-[var(--radius-xs)]",
            "text-[12px] text-text-muted hover:text-white hover:bg-white/5",
            "transition-[color,background-color] duration-100"
          )}
          onClick={() => onComment?.(content.id)}
          aria-label="Comments"
        >
          <MessageCircle className="size-[16px]" />
          {content.comments > 0 && <span className="font-medium">{content.comments}</span>}
        </Link>

        {/* Share */}
        <button
          onClick={handleShare}
          className={cn(
            "flex items-center gap-1 px-2 py-1.5 rounded-[var(--radius-xs)]",
            "text-[12px] transition-[color,background-color] duration-100",
            "active:scale-95",
            copied ? "text-emerald-400" : "text-text-muted hover:text-white hover:bg-white/5"
          )}
          aria-label={copied ? "Copied!" : "Share"}
        >
          {copied ? <CheckCircle2 className="size-[16px]" /> : <Share2 className="size-[16px]" />}
        </button>

        {/* Tip (spacer + right-aligned) */}
        <div className="flex-1" />
        {!content.isLocked && (
          <Button
            variant="gold"
            size="xs"
            className="gap-1 rounded-full"
            onClick={() => onTip?.(content.id)}
            aria-label="Send tip"
          >
            <DollarSign className="size-[11px]" />
            <span>Tip</span>
          </Button>
        )}
      </div>
    </article>
  );
}
