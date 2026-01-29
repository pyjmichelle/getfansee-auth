"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { type Comment } from "@/lib/comments";

interface CommentFormProps {
  postId: string;
  onCommentCreated?: (comment: Comment) => void;
  className?: string;
}

export function CommentForm({ postId, onCommentCreated, className }: CommentFormProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      toast.error("Comment cannot be empty");
      return;
    }

    if (trimmedContent.length > 1000) {
      toast.error("Comment is too long (max 1000 characters)");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmedContent }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to post comment");
      }

      // 成功
      setContent("");
      toast.success("Comment posted!");

      if (onCommentCreated && data.comment) {
        onCommentCreated(data.comment);
      }
    } catch (err) {
      const error = err as Error;
      console.error("[CommentForm] Error:", error);
      toast.error(error.message || "Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const characterCount = content.length;
  const isOverLimit = characterCount > 1000;

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-3", className)}>
      <div className="relative">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a comment..."
          className={cn(
            "min-h-[80px] resize-none",
            isOverLimit && "border-destructive focus-visible:ring-destructive"
          )}
          disabled={isSubmitting}
          aria-label="Comment content"
          aria-describedby="comment-char-count"
        />
        <div
          id="comment-char-count"
          className={cn(
            "absolute bottom-2 right-2 text-xs",
            isOverLimit ? "text-destructive" : "text-muted-foreground"
          )}
          aria-live="polite"
        >
          {characterCount}/1000
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isSubmitting || !content.trim() || isOverLimit}
          className="min-h-[44px] min-w-[100px]"
          aria-label={isSubmitting ? "Posting comment…" : "Post comment"}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              if (!isSubmitting && content.trim() && !isOverLimit) {
                handleSubmit(e as unknown as React.FormEvent);
              }
            }
          }}
        >
          {isSubmitting ? "Posting…" : "Post Comment"}
        </Button>
      </div>
    </form>
  );
}
