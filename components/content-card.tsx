"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, MessageCircle, Share2, Clock, Lock, MoreHorizontal, Gift } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ContentCardProps {
  creator: {
    id: string;
    name: string;
    username: string;
    avatar?: string;
    subscriptionPrice?: number;
  };
  content: {
    id: string;
    text?: string;
    image?: string;
    isLocked: boolean;
    price?: number;
    likes: number;
    comments: number;
    createdAt: string | Date;
    isLiked?: boolean;
    isExclusive?: boolean;
  };
  onUnlock?: (id: string) => void;
  onSubscribe?: (creatorId: string) => void;
  onLike?: (id: string) => void;
  onComment?: (id: string) => void;
  onShare?: (id: string) => void;
  onTip?: (id: string) => void;
  onCreatorClick?: () => void;
  className?: string;
}

/**
 * ContentCard - Figma Premium Design Style
 *
 * Features:
 * - Compact Fansly-style layout
 * - Urgency badge for exclusive content
 * - Gold tip button
 * - Enhanced lock overlay with emotional copy
 */
export function ContentCard({
  creator,
  content,
  onUnlock,
  onSubscribe,
  onLike,
  onComment,
  onShare,
  onTip,
  onCreatorClick,
  className,
}: ContentCardProps) {
  const [isLiked, setIsLiked] = useState(content.isLiked ?? false);
  const [likesCount, setLikesCount] = useState(content.likes);

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);
    onLike?.(content.id);
  };

  const handleCreatorClick = () => {
    onCreatorClick?.();
  };

  const timeAgo = formatDistanceToNow(new Date(content.createdAt), {
    addSuffix: true,
  });

  return (
    <article className={cn("bg-surface-base", className)}>
      {/* Creator Header - Compact */}
      <div className="px-3 py-2.5 flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 cursor-pointer ring-2 ring-transparent hover:ring-brand-primary/30 transition-all active:scale-95 transform"
          onClick={handleCreatorClick}
        >
          <Link href={`/creator/${creator.id}`}>
            <Avatar className="w-full h-full">
              <AvatarImage
                src={creator.avatar || "/placeholder.svg"}
                alt={creator.name}
                className="object-cover"
              />
              <AvatarFallback className="bg-brand-primary-alpha-10 text-brand-primary font-semibold text-sm">
                {(creator.name?.[0] || "C").toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
        <div className="flex-1 min-w-0">
          <Link
            href={`/creator/${creator.id}`}
            className="text-sm font-semibold truncate text-text-primary cursor-pointer hover:text-brand-primary transition-colors active:scale-95 inline-block"
            onClick={handleCreatorClick}
          >
            {creator.name}
          </Link>
          <div className="text-xs text-text-tertiary">
            @{creator.username} · {timeAgo}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="p-1.5 -mr-1.5 text-text-tertiary hover:text-text-primary"
        >
          <MoreHorizontal size={18} />
        </Button>
      </div>

      {/* Content Text */}
      {content.text && (
        <div className="px-3 pb-2.5 text-sm text-text-primary leading-relaxed">{content.text}</div>
      )}

      {/* Image/Media - Full width */}
      {content.image && (
        <div className="relative bg-black">
          <Image
            src={content.image}
            alt="Content"
            width={800}
            height={600}
            className={cn(
              "w-full transition-all duration-300",
              content.isLocked && "blur-2xl opacity-40"
            )}
            style={{ maxHeight: "80vh", objectFit: "contain" }}
          />

          {/* Lock Overlay - Premium Design */}
          {content.isLocked && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-black/20 via-black/40 to-black/60">
              <div className="text-center px-6 max-w-sm">
                {/* Urgency Badge */}
                {content.isExclusive && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-error/20 border border-error/40 rounded-full text-error text-xs font-bold mb-4 animate-pulse">
                    <Clock size={14} className="shrink-0" />
                    <span>24HR EXCLUSIVE</span>
                  </div>
                )}

                <div className="w-16 h-16 mx-auto mb-4 bg-brand-primary/20 backdrop-blur-md rounded-full flex items-center justify-center border border-brand-primary/30 shadow-glow">
                  <Lock size={28} className="text-brand-primary" />
                </div>

                <p className="text-white/90 text-sm mb-1 font-medium">Unlock Exclusive Content</p>
                <p className="text-white/60 text-xs mb-4">Behind-the-scenes · High quality</p>

                <Button
                  variant="subscribe-gradient"
                  size="lg"
                  onClick={() => onUnlock?.(content.id)}
                  className="w-full px-8 py-4 text-lg font-bold rounded-xl mb-3"
                >
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2">
                      <Lock size={20} />
                      <span>Unlock Now · ${content.price?.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-white/70 font-normal mt-0.5">
                      One-time access · Instant delivery
                    </p>
                  </div>
                </Button>

                {creator.subscriptionPrice && onSubscribe && (
                  <p className="text-xs text-white/60">
                    Or{" "}
                    <button
                      onClick={() => onSubscribe(creator.id)}
                      className="text-brand-primary font-semibold underline hover:text-brand-primary/80 transition-colors"
                    >
                      subscribe for ${creator.subscriptionPrice.toFixed(2)}/mo
                    </button>{" "}
                    for unlimited access
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions Bar - Premium Design */}
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1 mb-2">
          {/* Like */}
          <button
            onClick={handleLike}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all active:scale-95 transform",
              isLiked
                ? "text-error bg-error/10"
                : "text-text-tertiary hover:text-error hover:bg-error/5"
            )}
          >
            <Heart size={20} className={cn(isLiked && "fill-current")} />
            {likesCount > 0 && (
              <span className="text-sm font-semibold">{likesCount.toLocaleString()}</span>
            )}
          </button>

          {/* Comment */}
          <button
            onClick={() => onComment?.(content.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-text-tertiary hover:text-brand-primary hover:bg-brand-primary/5 transition-all active:scale-95 transform"
          >
            <MessageCircle size={20} />
            {content.comments > 0 && (
              <span className="text-sm font-semibold">{content.comments}</span>
            )}
          </button>

          {/* Share */}
          <button
            onClick={() => onShare?.(content.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-text-tertiary hover:text-brand-primary hover:bg-brand-primary/5 transition-all active:scale-95 transform"
          >
            <Share2 size={20} />
          </button>

          {/* Tip - Gold Button */}
          <Button
            variant="tip-gradient"
            size="sm"
            onClick={() => onTip?.(content.id)}
            className="ml-auto gap-1.5 px-4 py-2 rounded-full"
          >
            <Gift size={18} />
            <span className="hidden sm:inline">Send Tip</span>
            <span className="sm:hidden">Tip</span>
          </Button>
        </div>

        {/* Like count text - subtle */}
        {likesCount > 0 && (
          <p className="text-xs text-text-tertiary mb-1">
            {likesCount.toLocaleString()} {likesCount === 1 ? "like" : "likes"}
          </p>
        )}
      </div>
    </article>
  );
}
