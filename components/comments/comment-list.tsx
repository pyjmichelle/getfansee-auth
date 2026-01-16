"use client";

import { useState, useEffect } from "react";
import { CommentItem } from "./comment-item";
import { CommentForm } from "./comment-form";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Comment } from "@/lib/comments";

interface CommentListProps {
  postId: string;
  currentUserId?: string;
  canComment?: boolean;
  initialComments?: Comment[];
  className?: string;
}

export function CommentList({
  postId,
  currentUserId,
  canComment = false,
  initialComments = [],
  className,
}: CommentListProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  // 加载评论
  const loadComments = async (offset: number = 0) => {
    try {
      if (offset === 0) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const res = await fetch(`/api/posts/${postId}/comments?limit=20&offset=${offset}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load comments");
      }

      if (offset === 0) {
        setComments(data.comments || []);
      } else {
        setComments((prev) => [...prev, ...(data.comments || [])]);
      }

      setTotal(data.total || 0);
      setHasMore(data.hasMore || false);
    } catch (err) {
      const error = err as Error;
      console.error("[CommentList] Load error:", error);
      toast.error(error.message || "Failed to load comments");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // 初始加载
  useEffect(() => {
    if (initialComments.length === 0) {
      loadComments();
    }
  }, [postId]);

  // 处理新评论
  const handleCommentCreated = (newComment: Comment) => {
    setComments((prev) => [newComment, ...prev]);
    setTotal((prev) => prev + 1);
  };

  // 处理删除评论
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    setDeletingCommentId(commentId);

    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete comment");
      }

      // 从列表中移除
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setTotal((prev) => prev - 1);
      toast.success("Comment deleted");
    } catch (err) {
      const error = err as Error;
      console.error("[CommentList] Delete error:", error);
      toast.error(error.message || "Failed to delete comment");
    } finally {
      setDeletingCommentId(null);
    }
  };

  // 加载更多
  const handleLoadMore = () => {
    loadComments(comments.length);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* 标题 */}
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
        <h3 className="font-semibold text-lg">
          Comments {total > 0 && <span className="text-muted-foreground">({total})</span>}
        </h3>
      </div>

      <Separator />

      {/* 评论表单 */}
      {canComment && currentUserId && (
        <CommentForm postId={postId} onCommentCreated={handleCommentCreated} className="pb-4" />
      )}

      {!canComment && currentUserId && (
        <div className="p-4 bg-muted/50 rounded-lg text-center text-sm text-muted-foreground">
          Subscribe or purchase this content to comment
        </div>
      )}

      {/* 评论列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Loading comments...</span>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" aria-hidden="true" />
          <p className="text-sm">No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              onDelete={handleDeleteComment}
              isDeleting={deletingCommentId === comment.id}
            />
          ))}

          {/* 加载更多按钮 */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="min-h-[44px]"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    Loading...
                  </>
                ) : (
                  "Load More Comments"
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
