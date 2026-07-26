/**
 * Best-effort rate limiting for public/lightly-authenticated write endpoints.
 *
 * Found by the 2026-07-26 UI/performance audit: `app/api/creators/[id]/view`,
 * `app/api/newsletter/subscribe`, `app/api/follow`, and `app/api/save/*` had
 * zero throttling, so a single client could hammer view counters, trigger
 * unlimited confirmation emails, or spam follow/save writes.
 *
 * IMPORTANT — known limitation: this store is in-memory and scoped to a
 * single server process. On serverless platforms (Vercel) each warm lambda
 * instance keeps its own buckets, so a distributed attacker spread across
 * many concurrent instances is not fully stopped. This still blocks the
 * common case (one client hammering from one connection) and is a real
 * improvement over the previous zero limiting; a shared store (e.g. Upstash
 * Redis) is the correct upgrade if abuse from multiple instances is observed
 * in production. Tracked under `chief-security-architect` domain.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanupAt = Date.now();

function cleanupExpiredBuckets(now: number): void {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

/**
 * Fixed-window counter. `key` should already include the route name so
 * different endpoints don't share a budget (e.g. `view:1.2.3.4`).
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, resetAt, limit };
  }

  if (existing.count >= limit) {
    return { success: false, remaining: 0, resetAt: existing.resetAt, limit };
  }

  existing.count += 1;
  return {
    success: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
    limit,
  };
}

/** Best-effort client IP extraction behind Vercel/proxy forwarding headers. */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
    "Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
  };
}
