import type { NextRequest } from "next/server";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

function getHost(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return host.split(":")[0].toLowerCase();
}

function isAllowedHost(request: NextRequest): boolean {
  if (process.env.E2E_ALLOW_ANY_HOST === "true") return true;
  return LOCAL_HOSTS.has(getHost(request));
}

function hasValidSecret(request: NextRequest): boolean {
  const expected = process.env.TEST_ROUTE_SECRET;
  if (!expected) return true;
  const provided = request.headers.get("x-test-secret");
  return provided === expected;
}

export function canAccessTestRoute(request: NextRequest): boolean {
  const isTestEnv = process.env.E2E === "1" || process.env.PLAYWRIGHT_TEST_MODE === "true";

  if (!isTestEnv) return false;
  if (!isAllowedHost(request)) return false;
  if (!hasValidSecret(request)) return false;

  return true;
}
