"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MediaDisplay } from "@/components/media-display";
import { PostLikeButton } from "@/components/post-like-button";
import { ReportButton } from "@/components/report-button";
import {
  Lock,
  Share2,
  Heart,
  Eye,
  Calendar,
  Edit,
  Trash2,
  MessageCircle,
  Unlock,
} from "@/lib/icons";
import { formatDistanceToNow } from "date-fns";
import { type Post } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 卡片展示模式:
 * - feed: 首页/创作者主页帖子流（含订阅/解锁 CTA）
 * - preview: 搜索/标签页简洁预览
 * - manage: Creator Studio 管理视图（含编辑/删除操作）
 * - admin: Admin 内容审核视图（含管理员操作）
 */
export type PostCardVariant = "feed" | "preview" | "manage" | "admin";

interface PostCardBaseProps {
  post: Post;
  variant?: PostCardVariant;
  currentUserId?: string | null;
  className?: string;
  animationDelay?: number;
}

interface PostCardFeedProps extends PostCardBaseProps {
  variant?: "feed";
  isSubscribed?: boolean;
  isUnlocked?: boolean;
  isSubscribing?: boolean;
  onSubscribe?: (creatorId: string) => void;
  onUnlock?: (postId: string, priceCents: number) => void;
  onShare?: (postId: string) => void;
}

interface PostCardPreviewProps extends PostCardBaseProps {
  variant: "preview";
}

interface PostCardManageProps extends PostCardBaseProps {
  variant: "manage";
  onEdit?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  viewMode?: "grid" | "list";
}

interface PostCardAdminProps extends PostCardBaseProps {
  variant: "admin";
  onDelete?: (postId: string) => void;
  onView?: (postId: string) => void;
}

type PostCardProps =
  | PostCardFeedProps
  | PostCardPreviewProps
  | PostCardManageProps
  | PostCardAdminProps;

export function PostCard(props: PostCardProps) {
  const { post, variant = "feed", currentUserId, className, animationDelay } = props;

  const cardStyle =
    animationDelay !== undefined && animationDelay < 600
      ? {
          animation: `profile-reveal 300ms cubic-bezier(0.33,1,0.68,1) ${animationDelay}ms both`,
        }
      : undefined;

  if (variant === "preview") {
    return <PostCardPreview post={post} className={className} style={cardStyle} />;
  }

  if (variant === "manage") {
    const p = props as PostCardManageProps;
    return (
      <PostCardManage
        post={post}
        currentUserId={currentUserId}
        className={className}
        style={cardStyle}
        viewMode={p.viewMode}
        onEdit={p.onEdit}
        onDelete={p.onDelete}
      />
    );
  }

  if (variant === "admin") {
    const p = props as PostCardAdminProps;
    return (
      <PostCardAdmin
        post={post}
        className={className}
        style={cardStyle}
        onDelete={p.onDelete}
        onView={p.onView}
      />
    );
  }

  // Default: feed
  const p = props as PostCardFeedProps;
  return (
    <PostCardFeed
      post={post}
      currentUserId={currentUserId}
      className={className}
      style={cardStyle}
      isSubscribed={p.isSubscribed}
      isUnlocked={p.isUnlocked}
      isSubscribing={p.isSubscribing}
      onSubscribe={p.onSubscribe}
      onUnlock={p.onUnlock}
      onShare={p.onShare}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Feed Variant                                                                 */
/* -------------------------------------------------------------------------- */

interface FeedInternalProps {
  post: Post;
  currentUserId?: string | null;
  className?: string;
  style?: React.CSSProperties;
  isSubscribed?: boolean;
  isUnlocked?: boolean;
  isSubscribing?: boolean;
  onSubscribe?: (creatorId: string) => void;
  onUnlock?: (postId: string, priceCents: number) => void;
  onShare?: (postId: string) => void;
}

function PostCardFeed({
  post,
  currentUserId,
  className,
  style,
  isUnlocked,
  isSubscribing,
  onSubscribe,
  onUnlock,
  onShare,
}: FeedInternalProps) {
  const creatorId = post.creator_id;
  const isOwner = currentUserId && creatorId === currentUserId;
  const canView = isOwner || isUnlocked || post.visibility === "free";
  const isPPV = post.visibility === "ppv";

  return (
    <article
      className={cn("card-block hover-bold overflow-hidden", className)}
      style={style}
      data-testid="post-card"
      data-post-id={post.id}
      tabIndex={0}
    >
      {/* Creator Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <Link
          href={`/creator/${creatorId}`}
          className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-transparent hover:ring-brand-primary/30 transition-all focus-visible:ring-brand-primary"
          aria-label={`View ${post.creator?.display_name || "creator"}'s profile`}
        >
          <Avatar className="w-full h-full">
            <AvatarImage
              src={post.creator?.avatar_url || undefined}
              alt={post.creator?.display_name || "Creator"}
            />
            <AvatarFallback className="bg-brand-primary/10 text-brand-primary text-sm font-semibold">
              {post.creator?.display_name?.[0]?.toUpperCase() || "C"}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            href={`/creator/${creatorId}`}
            className="text-sm font-semibold truncate text-text-primary hover:text-brand-primary transition-colors block"
          >
            {post.creator?.display_name || "Creator"}
          </Link>
          <p className="text-xs text-text-tertiary">
            {post.created_at
              ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
              : "Unknown date"}
          </p>
        </div>

        {creatorId && !isOwner && !isUnlocked && onSubscribe && (
          <Button
            size="sm"
            variant="subscribe-gradient"
            onClick={(e) => {
              e.stopPropagation();
              onSubscribe(creatorId);
            }}
            disabled={isSubscribing}
            className="shrink-0 rounded-full px-4 min-h-[36px] active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
            data-testid="creator-subscribe-button"
            aria-label={`Subscribe to ${post.creator?.display_name || "creator"}`}
          >
            {isSubscribing ? "..." : "Subscribe"}
          </Button>
        )}
      </div>

      {/* Content */}
      {(post.title || post.content) && (
        <div className="px-4 pb-2">
          {post.title && (
            <Link href={`/posts/${post.id}`}>
              <h3 className="text-sm font-semibold mb-1 hover:text-brand-primary transition-colors cursor-pointer line-clamp-2 text-text-primary">
                {post.title}
              </h3>
            </Link>
          )}
          {post.content && canView && (
            <p className="text-text-secondary text-sm leading-relaxed line-clamp-3">
              {post.content}
            </p>
          )}
        </div>
      )}

      {/* Media */}
      {((post.media && post.media.length > 0) || post.media_url) && (
        <div className="relative">
          <MediaDisplay
            post={post}
            canView={canView || false}
            isCreator={!!isOwner}
            onSubscribe={() => creatorId && onSubscribe?.(creatorId)}
            onUnlock={async () => onUnlock?.(post.id, post.price_cents || 0)}
            creatorDisplayName={post.creator?.display_name}
          />
        </div>
      )}

      {/* Locked Overlay for Subscribers-only */}
      {!canView && post.visibility === "subscribers" && (
        <div className="px-4 py-6 text-center bg-surface-raised/50 border-t border-border-base">
          <Lock className="w-8 h-8 mx-auto mb-2 text-text-tertiary" aria-hidden="true" />
          <p className="text-sm text-text-tertiary mb-3">Subscribers only content</p>
          {onSubscribe && creatorId && (
            <Button
              size="sm"
              variant="subscribe-gradient"
              onClick={() => onSubscribe(creatorId)}
              className="rounded-full min-h-[36px] active:scale-95"
            >
              Subscribe to Unlock
            </Button>
          )}
        </div>
      )}

      {/* PPV Unlock */}
      {!canView && isPPV && (
        <div className="px-4 py-6 text-center bg-surface-raised/50 border-t border-border-base">
          <Lock className="w-8 h-8 mx-auto mb-2 text-brand-accent" aria-hidden="true" />
          <p className="text-sm text-text-tertiary mb-3">
            Unlock for ${((post.price_cents || 0) / 100).toFixed(2)}
          </p>
          {onUnlock && (
            <Button
              size="sm"
              variant="unlock-gradient"
              onClick={() => onUnlock(post.id, post.price_cents || 0)}
              className="rounded-full min-h-[36px] active:scale-95"
            >
              Unlock Now
            </Button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t border-border-base flex items-center gap-1">
        {currentUserId && (
          <PostLikeButton
            postId={post.id}
            initialLikesCount={post.likes_count || 0}
            userId={currentUserId}
          />
        )}
        {onShare && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-text-tertiary hover:text-brand-primary hover:bg-brand-primary/5 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
            onClick={() => onShare(post.id)}
            aria-label="Share this post"
          >
            <Share2 className="w-4 h-4" aria-hidden="true" />
          </Button>
        )}
        <ReportButton
          targetType="post"
          targetId={post.id}
          variant="ghost"
          size="sm"
          className="ml-auto text-text-tertiary"
        />
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Preview Variant                                                              */
/* -------------------------------------------------------------------------- */

function PostCardPreview({
  post,
  className,
  style,
}: {
  post: Post;
  className?: string;
  style?: React.CSSProperties;
}) {
  const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
  return (
    <div
      className={cn(
        "bg-surface-base border border-border-base rounded-2xl p-5 hover:border-brand-primary/30 transition-all hover-bold",
        className
      )}
      style={style}
    >
      <div className="flex items-start gap-3">
        <Link href={`/creator/${post.creator_id}`}>
          <Avatar className="h-10 w-10 rounded-xl">
            <AvatarImage
              src={profile?.avatar_url || post.creator?.avatar_url || undefined}
              alt={profile?.display_name || post.creator?.display_name}
            />
            <AvatarFallback className="bg-brand-primary-alpha-10 text-brand-primary rounded-xl">
              {(profile?.display_name || post.creator?.display_name)?.[0] || "C"}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Link
              href={`/creator/${post.creator_id}`}
              className="font-semibold text-text-primary hover:text-brand-primary transition-colors text-sm"
            >
              {profile?.display_name || post.creator?.display_name || "Creator"}
            </Link>
            <span className="text-xs text-text-tertiary">
              {post.created_at
                ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
                : ""}
            </span>
            {post.visibility === "ppv" && (
              <span className="px-2 py-0.5 bg-brand-accent/10 text-brand-accent text-xs font-semibold rounded-full">
                ${((post.price_cents ?? 0) / 100).toFixed(2)}
              </span>
            )}
            {post.visibility === "subscribers" && (
              <span className="px-2 py-0.5 bg-brand-primary-alpha-10 text-brand-primary text-xs font-semibold rounded-full">
                Subscribers
              </span>
            )}
          </div>
          {post.title && (
            <Link href={`/posts/${post.id}`}>
              <h3 className="font-semibold text-text-primary mb-1 hover:text-brand-primary transition-colors cursor-pointer text-sm">
                {post.title}
              </h3>
            </Link>
          )}
          <p className="text-sm text-text-tertiary line-clamp-2">{post.content}</p>
          {(post.likes_count ?? 0) > 0 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-text-tertiary">
              <Heart className="w-3 h-3" aria-hidden="true" />
              <span>{post.likes_count}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Manage Variant (Creator Studio)                                              */
/* -------------------------------------------------------------------------- */

function PostCardManage({
  post,
  className,
  style,
  viewMode = "list",
  onEdit,
  onDelete,
}: {
  post: Post;
  currentUserId?: string | null;
  className?: string;
  style?: React.CSSProperties;
  viewMode?: "grid" | "list";
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const isLocked = post.visibility !== "free";

  if (viewMode === "grid") {
    return (
      <div
        className={cn("card-block hover-bold overflow-hidden group", className)}
        style={style}
        data-testid="post-item"
        data-post-id={post.id}
      >
        <div className="relative">
          {(post.media && post.media.length > 0) || post.media_url ? (
            <div className="h-40 bg-surface-raised flex items-center justify-center">
              <Eye className="w-8 h-8 text-text-tertiary" aria-hidden="true" />
            </div>
          ) : (
            <div className="h-40 bg-gradient-subtle flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-text-tertiary" aria-hidden="true" />
            </div>
          )}
          {isLocked && (
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="bg-surface-base/80 backdrop-blur-sm">
                {post.visibility === "ppv" ? (
                  <Unlock className="w-3 h-3 mr-1" />
                ) : (
                  <Lock className="w-3 h-3 mr-1" />
                )}
                {post.visibility === "ppv"
                  ? `$${((post.price_cents || 0) / 100).toFixed(2)}`
                  : "Subs"}
              </Badge>
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-text-primary text-sm line-clamp-2 mb-1">
            {post.title || post.content.substring(0, 60) + "..."}
          </h3>
          <p className="text-xs text-text-tertiary mb-3">
            {post.created_at
              ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
              : ""}
          </p>
          <div className="flex items-center gap-2">
            {onEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(post.id)}
                className="flex-1 rounded-lg text-xs active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(post.id)}
                className="text-text-tertiary hover:text-error hover:bg-error/10 active:scale-95 focus-visible:ring-2 focus-visible:ring-error"
                aria-label="Delete post"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("card-block hover-bold p-4 md:p-5 flex items-start gap-4", className)}
      style={style}
      data-testid="post-item"
      data-post-id={post.id}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 mb-1">
          <Link href={`/posts/${post.id}`}>
            <h3 className="font-semibold text-text-primary text-sm hover:text-brand-primary transition-colors line-clamp-2">
              {post.title || post.content.substring(0, 80) + "..."}
            </h3>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            <Badge
              variant={
                post.visibility === "free"
                  ? "secondary"
                  : post.visibility === "ppv"
                    ? "default"
                    : "outline"
              }
              className={cn(
                "text-xs",
                post.visibility === "ppv" &&
                  "bg-brand-accent/10 text-brand-accent border-brand-accent/20",
                post.visibility === "subscribers" &&
                  "bg-brand-primary-alpha-10 text-brand-primary border-brand-primary/20"
              )}
            >
              {post.visibility === "free"
                ? "Free"
                : post.visibility === "ppv"
                  ? `$${((post.price_cents || 0) / 100).toFixed(2)}`
                  : "Subscribers"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-tertiary">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {post.created_at
              ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
              : ""}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="w-3 h-3" />
            {post.likes_count || 0}
          </span>
          {post.media && post.media.length > 0 && (
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {post.media.length} media
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(post.id)}
            className="text-text-tertiary hover:text-brand-primary hover:bg-brand-primary/5 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
            aria-label="Edit post"
          >
            <Edit className="w-4 h-4" />
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(post.id)}
            className="text-text-tertiary hover:text-error hover:bg-error/10 active:scale-95 focus-visible:ring-2 focus-visible:ring-error"
            aria-label="Delete post"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Admin Variant                                                                */
/* -------------------------------------------------------------------------- */

function PostCardAdmin({
  post,
  className,
  style,
  onDelete,
  onView,
}: {
  post: Post;
  className?: string;
  style?: React.CSSProperties;
  onDelete?: (id: string) => void;
  onView?: (id: string) => void;
}) {
  const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;

  return (
    <div
      className={cn("card-block hover-bold p-4 md:p-5", className)}
      style={style}
      data-testid="admin-post-item"
      data-post-id={post.id}
    >
      <div className="flex items-start gap-3">
        <Link href={`/creator/${post.creator_id}`}>
          <Avatar className="h-10 w-10 rounded-xl flex-shrink-0">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-brand-primary-alpha-10 text-brand-primary rounded-xl text-sm">
              {profile?.display_name?.[0] || "C"}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <Link
                href={`/creator/${post.creator_id}`}
                className="font-semibold text-text-primary hover:text-brand-primary transition-colors text-sm"
              >
                {profile?.display_name || "Creator"}
              </Link>
              <span className="text-xs text-text-tertiary ml-2">
                {post.created_at
                  ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
                  : ""}
              </span>
            </div>
            <Badge
              variant="secondary"
              className={cn(
                "text-xs shrink-0",
                post.visibility === "ppv" && "bg-brand-accent/10 text-brand-accent",
                post.visibility === "subscribers" && "bg-brand-primary-alpha-10 text-brand-primary"
              )}
            >
              {post.visibility}
            </Badge>
          </div>
          {post.title && (
            <h3 className="font-semibold text-text-primary text-sm mb-1 line-clamp-1">
              {post.title}
            </h3>
          )}
          <p className="text-text-secondary text-sm line-clamp-2 mb-3">{post.content}</p>
          <div className="flex items-center gap-2">
            {onView && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onView(post.id)}
                className="rounded-lg text-xs active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <Eye className="w-3 h-3 mr-1" />
                Preview
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete(post.id)}
                className="rounded-lg text-xs text-error border-error/30 hover:bg-error/10 active:scale-95 focus-visible:ring-2 focus-visible:ring-error"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
