"use client";

import Link from "next/link";
import Image from "next/image";
import { Lock, Video } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { Post } from "@/lib/types";

interface PostGridItemProps {
  post: Post;
  isUnlocked?: boolean;
  currentUserId?: string | null;
  onUnlock?: (post: Post) => void;
  className?: string;
}

export function PostGridItem({
  post,
  isUnlocked,
  currentUserId,
  onUnlock,
  className,
}: PostGridItemProps) {
  const unlockedForUser = isUnlocked || post.creator_id === currentUserId;
  const thumb = post.media_url || (post.media && post.media[0]?.media_url) || null;
  const isVideo = post.media && post.media[0]?.media_type === "video";
  const isLocked = post.visibility !== "free" && !unlockedForUser;

  const handleUnlockClick = (e: React.MouseEvent) => {
    if (onUnlock && isLocked) {
      e.preventDefault();
      onUnlock(post);
    }
  };

  return (
    <Link
      href={`/posts/${post.id}`}
      onClick={handleUnlockClick}
      className={cn(
        "relative aspect-square overflow-hidden group cursor-pointer block",
        "focus-visible:outline-2 focus-visible:outline-violet-500 focus-visible:outline-offset-1",
        className
      )}
    >
      {thumb ? (
        <Image
          src={thumb}
          alt=""
          fill
          className={cn(
            "object-cover group-hover:scale-105 transition-transform duration-300",
            isLocked && "blur-sm scale-105"
          )}
          sizes="(max-width: 768px) 33vw, 200px"
        />
      ) : (
        <div className="w-full h-full bg-surface-raised flex items-center justify-center">
          <Lock size={24} className="text-text-quaternary" aria-hidden="true" />
        </div>
      )}

      {/* Lock overlay for paid/subscriber posts */}
      {isLocked && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 p-2">
          <Lock size={16} className="text-white/80" aria-hidden="true" />
          {post.visibility === "ppv" && post.price_cents ? (
            <>
              <span className="text-white text-[11px] font-bold">
                ${(post.price_cents / 100).toFixed(2)}
              </span>
              {onUnlock && (
                <span className="px-2.5 py-1 rounded-full bg-amber-500 text-black text-[10px] font-bold tracking-wide">
                  Unlock
                </span>
              )}
            </>
          ) : (
            onUnlock && (
              <span className="px-2.5 py-1 rounded-full bg-violet-600 text-white text-[10px] font-bold tracking-wide">
                Subscribe
              </span>
            )
          )}
        </div>
      )}

      {/* Video indicator */}
      {isVideo && !isLocked && (
        <div className="absolute top-1.5 right-1.5 bg-black/60 rounded p-1 flex items-center justify-center">
          <Video size={10} className="text-white" aria-hidden="true" />
        </div>
      )}
    </Link>
  );
}
