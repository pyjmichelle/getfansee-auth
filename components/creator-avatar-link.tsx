"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface CreatorAvatarLinkProps {
  id: string;
  name?: string | null;
  avatarUrl?: string | null;
  size?: AvatarSize;
  showName?: boolean;
  subtitle?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

const sizeMap: Record<AvatarSize, string> = {
  xs: "w-7 h-7 text-tiny",
  sm: "w-9 h-9 text-small",
  md: "w-12 h-12 text-small",
  lg: "w-16 h-16 text-body-lg",
  xl: "w-24 h-24 text-xl",
};

export function CreatorAvatarLink({
  id,
  name,
  avatarUrl,
  size = "md",
  showName = true,
  subtitle,
  className,
  onClick,
}: CreatorAvatarLinkProps) {
  return (
    <Link
      href={`/creator/${id}`}
      className={cn(
        "flex items-center gap-3 group focus-visible:outline-2 focus-visible:outline-brand-primary rounded-xl",
        className
      )}
      aria-label={`View ${name || "creator"}'s profile`}
      onClick={onClick}
    >
      <Avatar
        className={cn(
          sizeMap[size],
          "ring-2 ring-transparent group-hover:ring-brand-primary/30 transition-all flex-shrink-0"
        )}
      >
        <AvatarImage
          src={avatarUrl || undefined}
          alt={name || "Creator"}
          className="object-cover"
        />
        <AvatarFallback className="bg-brand-primary-alpha-10 text-wine-text font-semibold">
          {name?.[0]?.toUpperCase() || "C"}
        </AvatarFallback>
      </Avatar>
      {showName && (
        <div className="min-w-0">
          <p className="font-semibold text-text-primary group-hover:text-wine-text transition-colors truncate text-small">
            {name || "Creator"}
          </p>
          {subtitle && <p className="text-tiny text-text-tertiary truncate">{subtitle}</p>}
        </div>
      )}
    </Link>
  );
}
