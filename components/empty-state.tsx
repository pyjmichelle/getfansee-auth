"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GlassIcon } from "@/components/glass-icon";
import { cn } from "@/lib/utils";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center gap-3",
        className
      )}
      {...props}
    >
      {icon && (
        <GlassIcon size="md" className="mb-1 text-white/40">
          {icon}
        </GlassIcon>
      )}
      <div className="space-y-1">
        <p className="text-[13px] font-medium text-text-secondary">{title}</p>
        {description && <p className="text-[12px] text-text-muted max-w-xs">{description}</p>}
      </div>
      {action &&
        (action.href ? (
          <Button asChild variant="outline" size="sm">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
