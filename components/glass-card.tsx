import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Adds a rose glow shadow */
  glow?: boolean;
  /** Override radius */
  radius?: "sm" | "md" | "lg";
}

export function GlassCard({ children, className, glow, radius = "md", ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        "glass-card",
        radius === "sm" && "rounded-[var(--radius-sm)]",
        radius === "md" && "rounded-[var(--radius-md)]",
        radius === "lg" && "rounded-[var(--radius-lg)]",
        glow && "shadow-glow-violet",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
