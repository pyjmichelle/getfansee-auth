import { cn } from "@/lib/utils";

interface TwoColumnPageProps {
  /** Page hero / header content, rendered above the two columns. */
  header?: React.ReactNode;
  /** Primary content column (list, form, etc). */
  main: React.ReactNode;
  /** Sticky right-rail column (stats, quick actions, FAQ, etc). */
  sidebar: React.ReactNode;
  className?: string;
  mainClassName?: string;
  sidebarClassName?: string;
}

/**
 * Shared account-page layout (T4 in the site-wide refactor plan): main
 * column + `w-72 sticky top-24` right rail on desktop, stacked on mobile.
 * Previously copy-pasted independently across wallet, subscriptions,
 * purchases, notifications, report, and support.
 */
export function TwoColumnPage({
  header,
  main,
  sidebar,
  className,
  mainClassName,
  sidebarClassName,
}: TwoColumnPageProps) {
  return (
    <div className={className}>
      {header}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        <div className={cn("flex-1 min-w-0", mainClassName)}>{main}</div>
        <aside className={cn("w-full lg:w-72 shrink-0", sidebarClassName)}>
          <div className="lg:sticky lg:top-24 space-y-4">{sidebar}</div>
        </aside>
      </div>
    </div>
  );
}
