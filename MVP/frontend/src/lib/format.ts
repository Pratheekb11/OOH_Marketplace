/**
 * Formatting helpers. Dates are parsed by hand from their ISO
 * (YYYY-MM-DD) string rather than via `new Date(iso)`.
 *
 * Trap: `new Date("2026-08-01")` parses as UTC midnight. `.toLocaleDateString()`
 * (or any local-timezone read) on that value renders as 31 Jul in any
 * negative-offset timezone. Splitting the string ourselves sidesteps the
 * round-trip entirely.
 */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function parseIsoParts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

/** "2026-08-01" -> "01 Aug 2026". Never round-trips through `Date`. */
export function formatIsoDate(iso: string): string {
  const { y, m, d } = parseIsoParts(iso);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

/** Inclusive day count between two ISO dates, e.g. same day = 1, matching
 * the backend's `base_amount = inclusive days × price_per_day`. Computed via
 * Date.UTC on the parsed components (not `new Date(string)`), so it is
 * immune to the parsing trap above. */
export function inclusiveDays(startIso: string, endIso: string): number {
  const start = parseIsoParts(startIso);
  const end = parseIsoParts(endIso);
  const startMs = Date.UTC(start.y, start.m - 1, start.d);
  const endMs = Date.UTC(end.y, end.m - 1, end.d);
  return Math.round((endMs - startMs) / 86_400_000) + 1;
}

/** Compact INR for cards: 45000 -> "₹45k", 120000 -> "₹120k". */
export function inrCompact(value: number): string {
  if (Math.abs(value) >= 1000) {
    const thousands = value / 1000;
    const rounded = Math.round(thousands * 10) / 10;
    const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `₹${str}k`;
  }
  return `₹${Math.round(value)}`;
}

/** Full INR with Indian digit grouping: 145000 -> "₹1,45,000.00". */
export function inrFull(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
