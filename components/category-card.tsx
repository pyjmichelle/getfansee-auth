import { cn } from "@/lib/utils";

interface CategoryCardProps {
  label: string;
  emoji: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function CategoryCard({ label, emoji, active, onClick, className }: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "card-block flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all",
        active
          ? "bg-brand-primary/15 border-brand-primary text-brand-primary"
          : "text-text-secondary",
        className
      )}
    >
      <span className="text-base" aria-hidden="true">
        {emoji}
      </span>
      <span>{label}</span>
    </button>
  );
}
