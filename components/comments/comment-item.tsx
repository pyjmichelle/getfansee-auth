"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Comment } from "@/lib/comments";

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  onDelete?: (commentId: string) => void;
  isDeleting?: boolean;
  className?: string;
}

export function CommentItem({
  comment,
  currentUserId,
  onDelete,
  isDeleting = false,
  className,
}: CommentItemProps) {
  const isOwnComment = currentUserId === comment.user_id;
  const initials = comment.user.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // 格式化时间
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={cn("flex gap-3 group", className)}>
      <Avatar className="w-10 h-10 flex-shrink-0">
        {comment.user.avatar_url && (
          <AvatarImage src={comment.user.avatar_url} alt={comment.user.display_name} />
        )}
        <AvatarFallback className="bg-primary/10 text-primary text-sm">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{comment.user.display_name}</span>
          <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
        </div>

        <p className="mt-1 text-sm text-foreground break-words whitespace-pre-wrap">
          {comment.content}
        </p>
      </div>

      {isOwnComment && onDelete && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(comment.id)}
          disabled={isDeleting}
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-[opacity] motion-safe:transition-[opacity] motion-reduce:transition-none",
            "h-8 w-8 p-0 flex-shrink-0 min-h-[32px] min-w-[32px]",
            "hover:bg-destructive/10 hover:text-destructive"
          )}
          aria-label="Delete comment"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onDelete(comment.id);
            }
          }}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
