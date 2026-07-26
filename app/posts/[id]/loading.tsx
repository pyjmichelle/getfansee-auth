import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      className="max-w-3xl mx-auto px-4 md:px-6 md:pt-4 py-6 space-y-6"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading post…</span>
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-2 w-24" />
        </div>
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}
