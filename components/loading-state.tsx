"use client";

import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  type?: "spinner" | "skeleton" | "pulse";
  text?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * LoadingState - 统一的加载状态组件
 *
 * @param type - 加载类型：spinner（旋转图标）、skeleton（骨架屏）、pulse（脉冲）
 * @param text - 加载提示文本
 * @param size - 尺寸大小
 *
 * @example
 * <LoadingState type="spinner" text="Loading..." />
 */
export function LoadingState({
  type = "spinner",
  text,
  className,
  size = "md",
}: LoadingStateProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  if (type === "skeleton") {
    return (
      <div className={cn("space-y-3", className)}>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  if (type === "pulse") {
    return (
      <div
        className={cn("flex items-center justify-center py-8", className)}
        role="status"
        aria-live="polite"
      >
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
          <div className="w-3 h-3 bg-primary rounded-full animate-pulse delay-75" />
          <div className="w-3 h-3 bg-primary rounded-full animate-pulse delay-150" />
        </div>
        {text && <span className="ml-3 text-muted-foreground">{text}</span>}
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-col items-center justify-center py-8 gap-3", className)}
      role="status"
      aria-live="polite"
    >
      <Loader2
        className={cn(sizeClasses[size], "animate-spin text-muted-foreground")}
        aria-hidden="true"
      />
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
      <span className="sr-only">{text || "Loading…"}</span>
    </div>
  );
}
