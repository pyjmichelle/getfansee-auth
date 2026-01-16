import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GridLayoutProps {
  children: ReactNode;
  cols?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: number;
  className?: string;
}

export function GridLayout({
  children,
  cols = { sm: 1, md: 2, lg: 3 },
  gap = 6,
  className,
}: GridLayoutProps) {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  };

  const gapClasses = {
    4: "gap-4",
    6: "gap-6",
    8: "gap-8",
  };

  return (
    <div
      className={cn(
        "grid",
        cols.sm && gridCols[cols.sm as keyof typeof gridCols],
        cols.md && `md:${gridCols[cols.md as keyof typeof gridCols]}`,
        cols.lg && `lg:${gridCols[cols.lg as keyof typeof gridCols]}`,
        cols.xl && `xl:${gridCols[cols.xl as keyof typeof gridCols]}`,
        gapClasses[gap as keyof typeof gapClasses] || "gap-6",
        className
      )}
    >
      {children}
    </div>
  );
}
