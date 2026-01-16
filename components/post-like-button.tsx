"use client";

import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { usePostLike } from "@/hooks/use-post-like";
import { cn } from "@/lib/utils";

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

  return (
    <Button
      variant="ghost"
      onClick={toggleLike}
      disabled={isLoading || !userId}
      className={cn("gap-2 hover:bg-white/5 rounded-xl min-h-[44px] min-w-[44px]", className)}
    >
      <Heart className={cn("w-4 h-4 transition-colors", isLiked && "fill-red-500 text-red-500")} />
      {likesCount > 0 && <span className="text-sm">{likesCount}</span>}
      <span className="hidden sm:inline">Like</span>
    </Button>
  );
}
