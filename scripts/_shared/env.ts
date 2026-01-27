/**
 * Unified environment configuration for all scripts
 * Single source of truth for BASE_URL and PORT
 */

/**
 * Get the base URL for the application
 * Priority: BASE_URL > PLAYWRIGHT_BASE_URL > construct from PORT > default
 */
export function getBaseUrl(): string {
  // Explicit BASE_URL takes highest priority
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }

  // Playwright's BASE_URL
  if (process.env.PLAYWRIGHT_BASE_URL) {
    return process.env.PLAYWRIGHT_BASE_URL;
  }

  // Construct from PORT
  const port = getPort();
  return `http://localhost:${port}`;
}

/**
 * Get the port number
 * Priority: PORT env var > default 3000
 */
export function getPort(): number {
  const port = process.env.PORT || process.env.NEXT_PUBLIC_PORT || "3000";
  return parseInt(port, 10);
}

/**
 * Get the full URL for a path
 */
export function getUrl(path: string): string {
  const base = getBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
