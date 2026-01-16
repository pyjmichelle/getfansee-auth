import { ReactNode } from "react";
import { NavHeader } from "@/components/nav-header";
import { CenteredContainer } from "./centered-container";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "5xl" | "6xl" | "7xl";
  className?: string;
  showNav?: boolean;
}

export function PageLayout({
  children,
  title,
  description,
  maxWidth = "7xl",
  className,
  showNav = true,
}: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {showNav && <NavHeader />}
      <main className={cn("py-6 sm:py-8 lg:py-12", className)}>
        <CenteredContainer maxWidth={maxWidth}>
          {title && (
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-2">{title}</h1>
              {description && <p className="text-lg text-muted-foreground">{description}</p>}
            </div>
          )}
          {children}
        </CenteredContainer>
      </main>
    </div>
  );
}
