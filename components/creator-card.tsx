"use client";

import Link from "next/link";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  };
  onSubscribe?: (id: string) => void;
  onClick?: (id: string) => void;
  className?: string;
}

/**
 * CreatorCard - Figma Make style creator profile card
 *
 * Features:
 * - Cover image with gradient fallback
 * - Avatar with overlap effect
 * - Creator info (name, username, bio)
 * - Stats (subscribers, posts)
 * - Subscribe button with price
 */
export function CreatorCard({ creator, onSubscribe, onClick, className }: CreatorCardProps) {
  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toLocaleString();
  };

  return (
    <article
      className={cn("card-figma-hover group cursor-pointer", className)}
      onClick={() => onClick?.(creator.id)}
    >
      {/* Cover Image */}
      <div className="h-24 relative overflow-hidden">
        {creator.coverImage ? (
          <Image
            src={creator.coverImage}
            alt=""
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30" />
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-4">
        {/* Avatar - overlapping cover */}
        <div className="-mt-8 mb-3">
          <Avatar className="w-16 h-16 ring-4 ring-card border-2 border-border">
            <AvatarImage src={creator.avatar || "/placeholder.svg"} alt={creator.name} />
            <AvatarFallback className="bg-primary-muted text-primary text-lg font-semibold">
              {(creator.name?.[0] || "C").toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Creator Info */}
        <div className="mb-3">
          <Link
            href={`/creator/${creator.id}`}
            className="block"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {creator.name}
            </h3>
            <p className="text-sm text-muted-foreground">@{creator.username}</p>
          </Link>

          {creator.bio && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{creator.bio}</p>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          <div>
            <span className="font-semibold text-foreground">
              {formatCount(creator.subscriberCount)}
            </span>
            <span className="ml-1">subscribers</span>
          </div>
          <div>
            <span className="font-semibold text-foreground">{formatCount(creator.postCount)}</span>
            <span className="ml-1">posts</span>
          </div>
        </div>

        {/* Subscribe Button */}
        <Button
          variant={creator.isSubscribed ? "secondary" : "subscribe-gradient"}
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            onSubscribe?.(creator.id);
          }}
        >
          {creator.isSubscribed
            ? "Subscribed"
            : `Subscribe · $${creator.subscriptionPrice.toFixed(2)}/mo`}
        </Button>
      </div>
    </article>
  );
}
