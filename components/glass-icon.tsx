import { cn } from "@/lib/utils";

interface GlassIconProps {
  children: React.ReactNode;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  glow?: "violet" | "gold" | "purple" | "none";
  className?: string;
}

const sizeMap = {
  xs: "size-7",
  sm: "size-9",
  md: "size-11",
  lg: "size-14",
  xl: "size-16",
};

const glowMap: Record<string, string> = {
  violet: "shadow-[0_0_16px_rgba(139,92,246,0.40)] border-violet-500/25",
  rose: "shadow-[0_0_16px_rgba(139,92,246,0.40)] border-violet-500/25",
  gold: "shadow-[0_0_16px_rgba(245,158,11,0.40)] border-amber-500/25",
  purple: "shadow-[0_0_16px_rgba(99,102,241,0.40)] border-indigo-500/25",
  none: "border-white/8",
};

/**
 * GlassIcon — rounded glass container for Phosphor icons.
 * Applies backdrop-blur, subtle gradient, and optional glow shadow.
 * Used for stat cards, empty states, feature highlights.
 */
export function GlassIcon({ children, size = "md", glow = "none", className }: GlassIconProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-[var(--radius-md)] shrink-0",
        "bg-white/6 backdrop-blur-md border",
        sizeMap[size],
        glowMap[glow],
        className
      )}
    >
      {children}
    </div>
  );
}
