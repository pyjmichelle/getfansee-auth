import type React from "react";
import type { Metadata } from "next";

// Creator studio pages are authenticated-only; exclude from search engine indexing
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Each studio page renders its own PageShell (user prop resolved client-side via
// useAuth()), so this layout stays a passthrough. The shared sidebar/nav lives in
// StudioShell (components/shells/studio-shell.tsx), which every sub-page wraps its
// content with directly, replacing the 7 duplicated inline `<aside>` implementations.
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
