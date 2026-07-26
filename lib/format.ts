/**
 * Single source of truth for currency/date formatting across the app.
 * Previously ~20 files hand-rolled `(cents / 100).toFixed(2)` or ad-hoc
 * `Intl.DateTimeFormat` calls independently, producing inconsistent
 * decimal/locale/timezone behavior (Layer 7 of the site-wide refactor plan).
 */

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactUsdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Format integer cents as "$12.34". */
export function formatUsd(cents: number): string {
  return usdFormatter.format((cents ?? 0) / 100);
}

/** Format integer cents as a compact string, e.g. "$1.2K". */
export function formatUsdCompact(cents: number): string {
  return compactUsdFormatter.format((cents ?? 0) / 100);
}

/** Format a dollar amount (not cents) as "$12.34". */
export function formatUsdFromDollars(dollars: number): string {
  return usdFormatter.format(dollars ?? 0);
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Format an ISO date string / Date as "Jan 5, 2026". */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

/** Format an ISO date string / Date as "Jan 5, 2026, 3:45 PM". */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

/** Format a large integer with thousands separators, e.g. "12,340". */
export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

/** Format a large integer compactly, e.g. "12.3K", "1.2M". */
export function formatCountCompact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    value ?? 0
  );
}
