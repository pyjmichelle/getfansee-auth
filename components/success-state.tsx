"use client";

import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SuccessStateProps {
  title?: string;
  message: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
  variant?: "inline" | "centered";
}

/**
 * SuccessState - 统一的成功状态组件
 * 符合 frontend-design 和 web-design-guidelines
 *
 * @param title - 成功标题
 * @param message - 成功消息
 * @param action - 操作按钮配置（可选）
 * @param variant - 显示变体：inline（内联）、centered（居中）
 *
 * @example
 * <SuccessState
 *   title="Success!"
 *   message="Your changes have been saved"
 *   action={{ label: "Continue", href: "/home" }}
 * />
 */
export function SuccessState({
  title = "Success!",
  message,
  action,
  className,
  variant = "centered",
}: SuccessStateProps) {
  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl",
          className
        )}
        role="status"
        aria-live="polite"
      >
        <CheckCircle
          className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0"
          aria-hidden="true"
        />
        <div className="flex-1">
          {title && <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>}
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        {action &&
          (action.href ? (
            <Button asChild variant="outline" size="sm" className="rounded-xl min-h-[32px]">
              <a href={action.href}>{action.label}</a>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={action.onClick}
              className="rounded-xl min-h-[32px]"
              aria-label={action.label}
            >
              {action.label}
            </Button>
          ))}
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}
      role="status"
      aria-live="polite"
    >
      <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
        <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">{message}</p>
      {action &&
        (action.href ? (
          <Button asChild variant="outline" className="gap-2 rounded-xl min-h-[44px]">
            <a href={action.href}>{action.label}</a>
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={action.onClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                action.onClick?.();
              }
            }}
            className="gap-2 rounded-xl min-h-[44px]"
            aria-label={action.label}
          >
            {action.label}
          </Button>
        ))}
    </div>
  );
}
