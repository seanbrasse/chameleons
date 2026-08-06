/**
 * Folding raw daily view rows into the figures the dashboard shows.
 *
 * Pure, so it unit-tests without a database and `today` is an argument rather
 * than a clock — the windows are deterministic and the domain stays I/O-free
 * (plan §5).
 */

export type ViewRow = { day: string; views: number };

export type ViewStats = { total: number; last7: number; last30: number };

/** Shift an ISO `YYYY-MM-DD` by whole days, in UTC, returning the same shape. */
function shiftDay(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Total, last 7 days and last 30 days. `day` strings are fixed-width ISO dates,
 * so a lexical comparison is a date comparison — no parsing per row. A stray
 * negative or non-integer count is clamped rather than trusted, since the value
 * ultimately comes from a public endpoint.
 */
export function summarizeViews(rows: ViewRow[], today: string): ViewStats {
  const from7 = shiftDay(today, -6);
  const from30 = shiftDay(today, -29);

  let total = 0;
  let last7 = 0;
  let last30 = 0;

  for (const { day, views } of rows) {
    const v = Number.isFinite(views) ? Math.max(0, Math.trunc(views)) : 0;
    total += v;
    if (day <= today && day >= from30) {
      last30 += v;
      if (day >= from7) last7 += v;
    }
  }

  return { total, last7, last30 };
}

/** A compact label for a count: 1240 -> "1.2k", 18000 -> "18k". */
export function compactCount(n: number): string {
  const v = Math.max(0, Math.trunc(n));
  if (v < 1000) return String(v);
  if (v < 10_000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (v < 1_000_000) return `${Math.round(v / 1000)}k`;
  return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}
