import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Override radius */
  radius?: "sm" | "md" | "lg";
}

export function GlassCard({ children, className, radius = "md", ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        "glass-card",
        radius === "sm" && "rounded-[var(--radius-sm)]",
        radius === "md" && "rounded-[var(--radius-md)]",
        radius === "lg" && "rounded-[var(--radius-lg)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
