import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";

interface LegalPageShellProps {
  title: string;
  /** Optional line rendered below the title (e.g. a short subtitle or last-updated date). */
  subtitle?: ReactNode;
  children: ReactNode;
}

/**
 * Shared chrome for all legal / static content pages (Terms, Privacy, DMCA, etc.):
 * back-to-home link, page title, optional subtitle, and the site footer.
 * Page bodies own their own prose wrapper so content-specific layout (cards, tables) still works.
 */
export function LegalPageShell({ title, subtitle, children }: LegalPageShellProps) {
  return (
    <div className="min-h-dvh bg-bg-base flex flex-col">
      <div className="flex-1 max-w-3xl mx-auto px-4 py-12 section-block w-full">
        <Link href="/">
          <Button variant="ghost" className="mb-8 hover-bold">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-h1 text-wine-text mb-4">{title}</h1>
        {subtitle && <div className="text-text-secondary mb-8">{subtitle}</div>}

        {children}
      </div>
      <SiteFooter />
    </div>
  );
}
