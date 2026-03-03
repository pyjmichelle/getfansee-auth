"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { completeRouteTransition } from "@/lib/perf-client";

export function RoutePerfTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    completeRouteTransition(pathname);
  }, [pathname]);

  return null;
}
