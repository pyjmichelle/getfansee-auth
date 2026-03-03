import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface CenteredContainerProps {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl";
  className?: string;
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

/** 符合 FIGMA_PIXEL_SPEC 的页面布局：px-4 md:px-6 */
export function CenteredContainer({
  children,
  maxWidth = "7xl",
  className,
}: CenteredContainerProps) {
  return (
    <div className={cn("mx-auto w-full px-4 md:px-6", maxWidthClasses[maxWidth], className)}>
      {children}
    </div>
  );
}
