"use client";

import { useEffect, useRef } from "react";
import { trackSkeletonDuration } from "@/lib/perf-client";

export function useSkeletonMetric(name: string, isLoading: boolean) {
  const startedAt = useRef<number | null>(
    typeof window !== "undefined" && isLoading ? performance.now() : null
  );
  const hasReported = useRef(false);

  useEffect(() => {
    if (isLoading && startedAt.current === null) {
      startedAt.current = performance.now();
      hasReported.current = false;
      return;
    }

    if (!isLoading && startedAt.current !== null && !hasReported.current) {
      trackSkeletonDuration(name, performance.now() - startedAt.current);
      hasReported.current = true;
      startedAt.current = null;
    }
  }, [isLoading, name]);
}
