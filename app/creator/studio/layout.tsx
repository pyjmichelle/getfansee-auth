import type React from "react";
import type { Metadata } from "next";

// Creator studio pages are authenticated-only; exclude from search engine indexing
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
