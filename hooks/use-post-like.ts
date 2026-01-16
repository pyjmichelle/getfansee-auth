import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * Hook for managing post likes with optimistic updates
 */
export function usePostLike(postId: string, initialLikesCount: number = 0, userId?: string) {
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 检查当前用户是否已点赞
  useEffect(() => {
    if (!userId) return;

    const checkLikeStatus = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from("post_likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .maybeSingle();

      setIsLiked(!!data);
    };

    checkLikeStatus();
  }, [postId, userId]);

  const toggleLike = async () => {
    if (!userId) {
      console.warn("[usePostLike] User not authenticated");
      return;
    }

    if (isLoading) return;

    // 乐观更新
    const previousIsLiked = isLiked;
    const previousLikesCount = likesCount;

    setIsLiked(!isLiked);
    setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);
    setIsLoading(true);

    try {
      const method = isLiked ? "DELETE" : "POST";
      const response = await fetch(`/api/posts/${postId}/like`, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (!result.success) {
        // 如果失败，回滚乐观更新
        setIsLiked(previousIsLiked);
        setLikesCount(previousLikesCount);
        console.error("[usePostLike] Toggle like failed:", result.error);
      } else {
        // 使用服务器返回的真实点赞数
        setLikesCount(result.likesCount);
      }
    } catch (err) {
      // 出错时回滚
      setIsLiked(previousIsLiked);
      setLikesCount(previousLikesCount);
      console.error("[usePostLike] Exception:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    likesCount,
    isLiked,
    isLoading,
    toggleLike,
  };
}
