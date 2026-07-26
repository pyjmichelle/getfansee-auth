import { cn } from "@/lib/utils";
import type { LucideIcon } from "@/lib/icons";

interface CategoryCardProps {
  label: string;
  /** Lucide icon component — replaces the old emoji string prop */
  icon?: LucideIcon;
  /** @deprecated Use icon instead. Still accepted to avoid breaking callers during migration. */
  emoji?: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function CategoryCard({
  label,
  icon: Icon,
  emoji,
  active,
  onClick,
  className,
}: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-[var(--radius-md)] px-4 py-2.5",
        "border text-[0.875rem] font-medium transition-[background-color,border-color,color] duration-150",
        "focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-[var(--wine)]",
        "active:scale-[0.98]",
        active
          ? "bg-[var(--wine-tint)] border-[var(--wine)] text-wine-text"
          : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:text-[var(--text-primary)]",
        className
      )}
    >
      {Icon ? (
        <Icon size={16} aria-hidden />
      ) : emoji ? (
        <span className="text-[1rem] leading-none" aria-hidden>
          {emoji}
        </span>
      ) : null}
      <span>{label}</span>
    </button>
  );
}
