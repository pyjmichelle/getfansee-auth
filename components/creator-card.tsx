"use client";

import Link from "next/link";
import Image from "next/image";
import { CheckCircle2 } from "@/lib/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_AVATAR_CREATOR } from "@/lib/image-fallbacks";

interface CreatorCardProps {
  creator: {
    id: string;
    name: string;
    username: string;
    avatar?: string;
    coverImage?: string;
    bio?: string;
    subscriberCount: number;
    postCount: number;
    subscriptionPrice: number;
    isSubscribed?: boolean;
    isVerified?: boolean;
  };
  onSubscribe?: (id: string) => void;
  onClick?: (id: string) => void;
  className?: string;
}

function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

export function CreatorCard({ creator, onSubscribe, onClick, className }: CreatorCardProps) {
  return (
    <article
      className={cn(
        "glass-card rounded-[var(--radius-md)] overflow-hidden group",
        "card-interactive flex flex-col",
        className
      )}
      onClick={() => onClick?.(creator.id)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(creator.id);
        }
      }}
      role="button"
      aria-label={`View ${creator.name}'s profile`}
    >
      {/* Cover image */}
      <div className="aspect-creator-card relative overflow-hidden bg-bg-surface">
        {creator.coverImage ? (
          <Image
            src={creator.coverImage}
            alt=""
            fill
            className="object-cover group-hover:scale-[1.04] transition-transform duration-400"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-premium opacity-40" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-overlay" />

        {/* Floating avatar */}
        <div className="absolute bottom-3 left-3">
          <Avatar className="size-10 ring-2 ring-black/50">
            <AvatarImage src={creator.avatar || DEFAULT_AVATAR_CREATOR} alt={creator.name} />
            <AvatarFallback className="text-[14px] font-bold">
              {(creator.name?.[0] || "C").toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Subscribe CTA (hover overlay on PC) */}
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
          <Button
            variant={creator.isSubscribed ? "outline" : "violet"}
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              onSubscribe?.(creator.id);
            }}
            className="shadow-lg"
          >
            {creator.isSubscribed ? "Subscribed" : "Subscribe"}
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link
              href={`/creator/${creator.id}`}
              className="flex items-center gap-1 group/link"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-[13px] font-semibold text-white group-hover/link:text-violet-400 transition-colors duration-150 truncate">
                {creator.name}
              </span>
              {creator.isVerified && (
                <CheckCircle2 className="size-[13px] text-amber-400 shrink-0" />
              )}
            </Link>
            <p className="text-[11px] text-text-muted truncate">@{creator.username}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[12px] font-semibold text-amber-400">
              ${creator.subscriptionPrice.toFixed(2)}
            </p>
            <p className="text-[10px] text-text-muted">per mo</p>
          </div>
        </div>

        {creator.bio && (
          <p className="text-[12px] text-text-muted line-clamp-2 leading-snug">{creator.bio}</p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 text-[11px] text-text-muted mt-auto">
          <span>
            <span className="text-text-secondary font-medium">
              {formatCount(creator.postCount)}
            </span>{" "}
            posts
          </span>
          <span>
            <span className="text-text-secondary font-medium">
              {formatCount(creator.subscriberCount)}
            </span>{" "}
            fans
          </span>
        </div>

        {/* Subscribe button — always visible */}
        <Button
          variant={creator.isSubscribed ? "outline" : "violet"}
          size="default"
          className="w-full mt-1"
          onClick={(e) => {
            e.stopPropagation();
            onSubscribe?.(creator.id);
          }}
          aria-label={
            creator.isSubscribed
              ? `Already subscribed to ${creator.name}`
              : `Subscribe to ${creator.name} for $${creator.subscriptionPrice.toFixed(2)}/month`
          }
        >
          {creator.isSubscribed
            ? "✓ Subscribed"
            : `Subscribe · $${creator.subscriptionPrice.toFixed(2)}/mo`}
        </Button>
      </div>
    </article>
  );
}
