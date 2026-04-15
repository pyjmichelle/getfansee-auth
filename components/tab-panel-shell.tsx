import { cn } from "@/lib/utils";

interface TabPanelShellProps {
  children: React.ReactNode;
  className?: string;
  minHeight?: string;
}

export function TabPanelShell({
  children,
  className,
  minHeight = "min-h-[400px]",
}: TabPanelShellProps) {
  return <div className={cn(minHeight, "w-full", className)}>{children}</div>;
}

interface SectionEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: SectionEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center min-h-[300px]",
        className
      )}
    >
      <div className="w-16 h-16 rounded-full bg-surface-raised flex items-center justify-center mb-4">
        {icon}
      </div>
      <h4 className="font-semibold text-text-primary mb-1">{title}</h4>
      {description && <p className="text-sm text-text-tertiary max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
