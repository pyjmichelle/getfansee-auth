import { Skeleton } from "@/components/ui/skeleton";

/**
 * Matches the real HomeFeedClient layout so there is no jump when the feed
 * hydrates: a sticky tag-chip row + For You / Following tabs, then post cards
 * with the same avatar / text / media / action-row rhythm as PostCard.
 */
export default function Loading() {
  return (
    <div
      className="max-w-2xl mx-auto w-full"
      role="status"
      aria-live="polite"
      data-testid="home-feed-skeleton"
    >
      <span className="sr-only">Loading feed…</span>

      {/* Sticky header: trending tag chips + feed tabs */}
      <div className="sticky top-[var(--nav-height)] bg-bg-base border-b border-border-subtle mb-6">
        <div className="flex items-center gap-2 px-3 py-2 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-full shrink-0" />
          ))}
        </div>
        <div className="flex">
          {[0, 1].map((i) => (
            <div key={i} className="flex-1 flex justify-center py-3">
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Post cards */}
      <div className="px-3 space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card-block overflow-hidden">
            <div className="flex items-center gap-3 p-3.5">
              <Skeleton className="size-10 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2 w-20" />
              </div>
            </div>
            <div className="px-3.5 pb-2 space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <Skeleton className="w-full aspect-[4/5] md:aspect-[16/9] md:max-h-[560px] rounded-none" />
            <div className="flex items-center gap-6 p-3.5">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
