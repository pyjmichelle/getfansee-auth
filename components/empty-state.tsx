"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

/**
 * EmptyState - 统一的空状态组件
 *
 * @param icon - 显示的图标（ReactNode）
 * @param title - 标题文本
 * @param description - 描述文本（可选）
 * @param action - 操作按钮配置（可选）
 *
 * @example
 * <EmptyState
 *   icon={<FileText className="w-8 h-8 text-muted-foreground" />}
 *   title="No posts yet"
 *   description="Start creating content to see it here"
 *   action={{ label: "Create Post", href: "/creator/new-post" }}
 * />
 */
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
      className={cn("flex flex-col items-center justify-center py-16 px-4 text-center", className)}
      {...props}
    >
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>}
      {action &&
        (action.href ? (
          <Button asChild variant="outline" className="rounded-xl">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button variant="outline" className="rounded-xl" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
