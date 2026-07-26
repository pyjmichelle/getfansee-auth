import { Suspense } from "react";
import type { Metadata } from "next";
import CreatorsDirectoryClient from "./CreatorsDirectoryClient";
import { Loader2 } from "@/lib/icons";

export const metadata: Metadata = {
  title: "Discover Creators — GetFanSee",
  description:
    "Browse verified creators by category and tags. Discover creators you'll actually want to follow on GetFanSee.",
  alternates: {
    canonical: "/creators",
  },
  openGraph: {
    title: "Discover Creators — GetFanSee",
    description: "Browse verified creators by category and tags on GetFanSee.",
    url: "/creators",
    type: "website",
  },
};

function DirectoryLoadingFallback() {
  return (
    <div
      className="min-h-dvh bg-background flex items-center justify-center"
      role="status"
      aria-live="polite"
      data-testid="creators-directory-loading"
    >
      <Loader2 className="w-8 h-8 animate-spin text-text-tertiary" aria-hidden="true" />
      <span className="sr-only">Loading creators...</span>
    </div>
  );
}

export default function CreatorsDirectoryPage() {
  return (
    <Suspense fallback={<DirectoryLoadingFallback />}>
      <CreatorsDirectoryClient />
    </Suspense>
  );
}
