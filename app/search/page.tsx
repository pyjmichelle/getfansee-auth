import { Suspense } from "react";
import type { Metadata } from "next";
import SearchPageClient from "./SearchPageClient";
import { Loader2 } from "@/lib/icons";

export const metadata: Metadata = {
  title: "Search — GetFanSee",
  description: "Search creators and posts on GetFanSee.",
  alternates: {
    canonical: "/search",
  },
};

function SearchLoadingFallback() {
  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center"
      role="status"
      aria-live="polite"
      data-testid="search-loading"
    >
      <Loader2 className="w-8 h-8 animate-spin text-text-tertiary" aria-hidden="true" />
      <span className="sr-only">Loading search...</span>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchLoadingFallback />}>
      <SearchPageClient />
    </Suspense>
  );
}
