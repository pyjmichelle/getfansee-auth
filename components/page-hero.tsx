import { cn } from "@/lib/utils";

interface PageHeroProps {
  title: string;
  subtitle?: string;
  compact?: boolean;
  className?: string;
}

export function PageHero({ title, subtitle, compact = false, className }: PageHeroProps) {
  return (
    <section
      className={cn(
        "mesh-bg relative overflow-hidden border-b border-border-base",
        compact ? "py-10" : "py-14",
        className
      )}
    >
      <div className="mx-auto max-w-5xl px-4 md:px-6 text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary">{title}</h1>
        {subtitle ? (
          <p className="mt-2 text-sm md:text-base text-text-secondary">{subtitle}</p>
        ) : null}
      </div>
    </section>
  );
}
