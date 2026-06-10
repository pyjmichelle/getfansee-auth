"use client";

/**
 * Auth bootstrap (client).
 *
 * Architecture: the authoritative auth state is rendered server-side at the
 * root layout and injected into `AuthProvider`, which pushes it into the
 * module-level snapshot below via `setAuthSnapshot()`. `getAuthBootstrap()`
 * then returns that snapshot synchronously — ZERO network, so it can never
 * hang and can never leave a page stuck on a skeleton.
 *
 * The bounded `/api/auth/bootstrap` fetch is kept only as a self-healing
 * fallback (e.g. forced refresh, or the rare case the provider has not mounted
 * yet) and is always raced against an 8s timeout.
 */

export type BootstrapResponse = {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
  };
  profile?: {
    role: "fan" | "creator" | "admin";
    display_name: string;
    avatar_url: string | null;
  } | null;
};

const FETCH_TIMEOUT_MS = 8000;

let snapshot: BootstrapResponse = { authenticated: false };
let snapshotInitialized = false;

/**
 * Called by AuthProvider on every render with the SSR-injected auth state.
 * Keeps the non-hook `getAuthBootstrap()` consumers in sync without a fetch.
 */
export function setAuthSnapshot(value: BootstrapResponse) {
  snapshot = value;
  snapshotInitialized = true;
}

export function getAuthSnapshot(): BootstrapResponse {
  return snapshot;
}

async function fetchBootstrapWithTimeout(): Promise<BootstrapResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch("/api/auth/bootstrap", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      return snapshotInitialized ? snapshot : { authenticated: false };
    }
    const value = (await res.json()) as BootstrapResponse;
    setAuthSnapshot(value);
    return value;
  } catch {
    // Timeout or network failure: never hang — return last known snapshot.
    return snapshotInitialized ? snapshot : { authenticated: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function getAuthBootstrap(force = false): Promise<BootstrapResponse> {
  // Fast path: provider injected the SSR snapshot — return it synchronously.
  if (!force && snapshotInitialized) {
    return snapshot;
  }
  // Forced refresh, or provider not yet mounted: bounded fetch (cannot hang).
  return fetchBootstrapWithTimeout();
}

/**
 * Kept for API compatibility. The snapshot is now authoritative and is kept
 * fresh by AuthProvider (SSR + onAuthStateChange -> router.refresh()), so an
 * explicit invalidation only forces the next call to re-read via fetch.
 */
export function invalidateAuthBootstrap() {
  snapshotInitialized = false;
}

export function prefetchAuthBootstrap() {
  // No-op: the auth snapshot is injected via SSR. Kept for API compatibility.
}
