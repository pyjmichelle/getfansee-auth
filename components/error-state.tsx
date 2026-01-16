"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
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
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-destructive" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">{message}</p>
        {retry && (
          <Button onClick={retry} variant="outline" className="gap-2 rounded-xl">
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
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
