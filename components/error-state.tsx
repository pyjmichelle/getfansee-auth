"use client";

import { AlertCircle, RefreshCw } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message: string;
  retry?: () => void;
  className?: string;
  variant?: "inline" | "centered";
}

/**
 * ErrorState - 统一的错误状态组件
 *
 * @param title - 错误标题
 * @param message - 错误消息
 * @param retry - 重试回调函数
 * @param variant - 显示变体：inline（内联）、centered（居中）
 *
 * @example
 * <ErrorState
 *   title="Something went wrong"
 *   message="Failed to load data"
 *   retry={() => fetchData()}
 * />
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  retry,
  className,
  variant = "inline",
}: ErrorStateProps) {
  if (variant === "centered") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-12 px-4 text-center",
          className
        )}
        role="alert"
      >
        <div className="size-12 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
          <AlertCircle className="size-5 text-red-400" aria-hidden="true" />
        </div>
        <h3 className="text-[14px] font-semibold text-white mb-1">{title}</h3>
        <p className="text-[13px] text-text-muted mb-5 max-w-xs">{message}</p>
        {retry && (
          <Button onClick={retry} variant="outline" size="sm" className="gap-1.5">
            <RefreshCw className="size-[13px]" aria-hidden="true" />
            Try Again
          </Button>
        )}
      </div>
    );
  }

  return (
    <Alert variant="destructive" className={cn(className)} role="alert">
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
        <span>{message}</span>
        {retry && (
          <Button variant="ghost" size="sm" onClick={retry} className="h-8 px-2">
            <RefreshCw className="w-4 h-4 mr-1" aria-hidden="true" />
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
