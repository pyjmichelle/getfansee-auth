import { Suspense } from "react";
import SearchPageClient from "./SearchPageClient";
import { Loader2 } from "lucide-react";

function SearchLoadingFallback() {
  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center"
      role="status"
      aria-live="polite"
      data-testid="search-loading"
    >
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden="true" />
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
