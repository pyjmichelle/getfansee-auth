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
  className?: string;
}

export function PostGridItem({ post, isUnlocked, currentUserId, className }: PostGridItemProps) {
  const unlockedForUser = isUnlocked || post.creator_id === currentUserId;
  const thumb = post.media_url || (post.media && post.media[0]?.media_url) || null;
  const isVideo = post.media && post.media[0]?.media_type === "video";

  return (
    <Link
      href={`/posts/${post.id}`}
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
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 768px) 33vw, 200px"
        />
      ) : (
        <div className="w-full h-full bg-surface-raised flex items-center justify-center">
          <Lock size={24} className="text-text-quaternary" aria-hidden="true" />
        </div>
      )}

      {/* Lock overlay for paid/subscriber posts */}
      {post.visibility !== "free" && !unlockedForUser && (
        <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center gap-1">
          <Lock size={20} className="text-white" aria-hidden="true" />
          {post.visibility === "ppv" && post.price_cents && (
            <span className="text-white text-[13px] font-bold">
              ${(post.price_cents / 100).toFixed(2)}
            </span>
          )}
        </div>
      )}

      {/* Video indicator */}
      {isVideo && (
        <div className="absolute top-1.5 right-1.5 bg-black/60 rounded p-1 flex items-center justify-center">
          <Video size={10} className="text-white" aria-hidden="true" />
        </div>
      )}
    </Link>
  );
}
