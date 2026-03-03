"use client";

import { Button } from "@/components/ui/button";
import { Heart } from "@/lib/icons";
import { usePostLike } from "@/hooks/use-post-like";
import { cn } from "@/lib/utils";
import { Analytics } from "@/lib/analytics";

interface PostLikeButtonProps {
  postId: string;
  initialLikesCount?: number;
  userId?: string;
  className?: string;
}

export function PostLikeButton({
  postId,
  initialLikesCount = 0,
  userId,
  className,
}: PostLikeButtonProps) {
  const { likesCount, isLiked, isLoading, toggleLike } = usePostLike(
    postId,
    initialLikesCount,
    userId
  );

  const handleLike = () => {
    if (!isLiked) {
      Analytics.contentLiked(postId, "");
    }
    toggleLike();
  };

  return (
    <Button
      variant="ghost"
      onClick={handleLike}
      disabled={isLoading || !userId}
      className={cn("gap-2 hover:bg-white/5 rounded-xl min-h-[44px] min-w-[44px]", className)}
    >
      <Heart
        className={cn(
          "w-4 h-4 transition-colors",
          isLiked && "fill-[var(--color-pink-500)] text-[var(--color-pink-500)]"
        )}
      />
      {likesCount > 0 && <span className="text-sm">{likesCount}</span>}
      <span className="hidden sm:inline">Like</span>
    </Button>
  );
}
