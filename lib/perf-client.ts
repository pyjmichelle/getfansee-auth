"use client";

import { Analytics } from "@/lib/analytics";

const LAST_ROUTE_START_KEY = "gfs_route_start";
const LAST_ROUTE_META_KEY = "gfs_route_meta";

type RouteMeta = {
  from?: string;
  to: string;
};

export function startRouteTransition(to: string, from?: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(LAST_ROUTE_START_KEY, String(performance.now()));
  const meta: RouteMeta = { to, from };
  sessionStorage.setItem(LAST_ROUTE_META_KEY, JSON.stringify(meta));
}

export function completeRouteTransition(pathname: string) {
  if (typeof window === "undefined") return;
  const rawStart = sessionStorage.getItem(LAST_ROUTE_START_KEY);
  const rawMeta = sessionStorage.getItem(LAST_ROUTE_META_KEY);
  if (!rawStart || !rawMeta) return;

  let meta: RouteMeta | null = null;
  try {
    meta = JSON.parse(rawMeta) as RouteMeta;
  } catch {
    meta = null;
  }

  const start = Number(rawStart);
  if (!Number.isFinite(start) || !meta) return;
  const durationMs = Math.round(performance.now() - start);

  // Ignore stale marks for unrelated route.
  if (meta.to && pathname !== meta.to) return;

  Analytics.track("route_transition_completed", {
    from: meta.from ?? null,
    to: meta.to,
    duration_ms: durationMs,
  });

  sessionStorage.removeItem(LAST_ROUTE_START_KEY);
  sessionStorage.removeItem(LAST_ROUTE_META_KEY);
}

export function trackSkeletonDuration(name: string, durationMs: number) {
  Analytics.track("skeleton_duration", {
    skeleton_name: name,
    duration_ms: Math.max(0, Math.round(durationMs)),
  });
}
