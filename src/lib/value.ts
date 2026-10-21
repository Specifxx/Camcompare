// "What should it be worth used?" From the used asking prices we've seen at
// the stores we track, day by day (price history usedMid/usedN). These are
// asking prices, not confirmed sales: eBay's sold data (Marketplace Insights
// API) needs eBay's approval, and it slots in here when granted.
import type { ChartDay, HistoryPoint } from "./offers";

export type UsedValue = { value: number; low: number; high: number; days: number; listings: number };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

/** Typical used price over the last `windowDays`, once there are at least `minDays` days of used prices. */
export function usedValue(history: HistoryPoint[], windowDays = 90, minDays = 7): UsedValue | null {
  if (!history.length) return null;
  const last = history[history.length - 1].day;
  const from = new Date(Date.parse(last) - windowDays * 86400_000).toISOString().slice(0, 10);
  const pts = history.filter((p) => p.day >= from && (p.usedMid ?? p.used) !== undefined);
  if (pts.length < minDays) return null;
  const mids = pts.map((p) => (p.usedMid ?? p.used)!);
  const sorted = [...mids].sort((a, b) => a - b);
  const q = (f: number) => sorted[Math.min(sorted.length - 1, Math.floor(f * (sorted.length - 1)))];
  return { value: median(mids), low: q(0.1), high: q(0.9), days: pts.length, listings: pts.reduce((n, p) => n + (p.usedN ?? 1), 0) };
}

export type UsedMonth = { month: string; low: number; typical: number; high: number; days: number };

/** Used prices month by month, newest first: the cheapest, typical and highest asking price seen. */
export function usedByMonth(history: HistoryPoint[]): UsedMonth[] {
  const by = new Map<string, { lows: number[]; mids: number[] }>();
  for (const p of history) {
    if (p.used === undefined) continue;
    const m = p.day.slice(0, 7);
    const e = by.get(m) ?? by.set(m, { lows: [], mids: [] }).get(m)!;
    e.lows.push(p.used);
    e.mids.push(p.usedMid ?? p.used);
  }
  return [...by]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, e]) => ({ month, low: Math.min(...e.lows), typical: median(e.mids), high: Math.max(...e.mids), days: e.lows.length }));
}

// ------------------------------------------------------------ price chart
// The product page's price history (components/PriceHistory.tsx), like
// camelcamelcamel: lowest, highest and typical over a range, and "Is this a
// good price?". Client-safe: the chart runs these in the browser on the
// product's static /history/<market>/<slug>.json.

export const RANGES = ["1M", "3M", "6M", "1Y", "All"] as const;
export type RangeKey = (typeof RANGES)[number];
export const RANGE_DAYS: Record<RangeKey, number> = { "1M": 31, "3M": 92, "6M": 183, "1Y": 366, All: Infinity };
const DAY_MS = 86400_000;
export const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * DAY_MS).toISOString().slice(0, 10);

/** The days within `range` of `last` (the newest day we have). */
export function inRange<T extends { day: string }>(days: T[], range: RangeKey, last: string): T[] {
  if (range === "All") return days;
  const from = addDays(last, -RANGE_DAYS[range]);
  return days.filter((d) => d.day >= from);
}

export type Extreme = { value: number; day: string; at?: string; archived: boolean };
export type SeriesStats = { low: Extreme; high: Extreme; typical: number; days: number };

/** Lowest, highest and typical (median of the daily lows) of one condition, or null with no days. */
export function seriesStats(days: ChartDay[], field: "new" | "used"): SeriesStats | null {
  const pts = days.filter((d) => d[field] !== undefined);
  if (!pts.length) return null;
  const ex = (d: ChartDay): Extreme => ({ value: d[field]!, day: d.day, at: field === "new" ? d.newAt : d.usedAt, archived: d.archived });
  let low = pts[0];
  let high = pts[0];
  for (const d of pts) {
    if (d[field]! < low[field]!) low = d;
    if (d[field]! > high[field]!) high = d;
  }
  return { low: ex(low), high: ex(high), typical: median(pts.map((d) => d[field]!)), days: pts.length };
}

export type PriceVerdict = {
  tone: "good" | "fair" | "high" | "unknown";
  /** "Lower than 80% of the last 6 months" */
  headline: string;
  /** Share of the window's days priced above today, 0–100. */
  pctHigher: number | null;
  /** Today against the window's typical price, in % (negative: under it). */
  vsTypical: number | null;
  typical: number | null;
  low: Extreme | null;
  windowLabel: string;
};

const WINDOW_LABEL: Record<number, string> = { 31: "month", 92: "3 months", 183: "6 months", 366: "year" };

/**
 * "Is this a good price?" Today's lowest against the last `windowDays` of
 * daily lows (recorded and archived alike): the share of those days that were
 * dearer, and how today sits against the typical and the lowest. Needs
 * `minDays` days of history in the window to say anything.
 */
export function priceVerdict(days: ChartDay[], today: number | null, field: "new" | "used", last: string, windowDays = 183, minDays = 5): PriceVerdict {
  const windowLabel = WINDOW_LABEL[windowDays] ?? `${windowDays} days`;
  const from = addDays(last, -windowDays);
  const pts = days.filter((d) => d.day >= from && d[field] !== undefined);
  const stats = seriesStats(pts, field);
  const base = { pctHigher: null, vsTypical: null, typical: stats?.typical ?? null, low: stats?.low ?? null, windowLabel };
  if (today === null) return { ...base, tone: "unknown", headline: "No price today to judge." };
  if (!stats || pts.length < minDays) return { ...base, tone: "unknown", headline: `Not enough price history yet to judge (${pts.length} day${pts.length === 1 ? "" : "s"} in the last ${windowLabel}).` };
  const higher = pts.filter((d) => d[field]! > today).length;
  const lower = pts.filter((d) => d[field]! < today).length;
  const pctHigher = Math.round((higher / pts.length) * 100);
  const pctLower = Math.round((lower / pts.length) * 100);
  const vsTypical = Math.round(((today - stats.typical) / stats.typical) * 100);
  let tone: PriceVerdict["tone"];
  let headline: string;
  if (today <= stats.low.value) {
    tone = "good";
    headline = today < stats.low.value ? `The lowest price in the last ${windowLabel}` : `Matches the lowest price of the last ${windowLabel}`;
  } else if (pctHigher >= 50) {
    tone = pctHigher >= 75 ? "good" : "fair";
    headline = `Lower than ${pctHigher}% of the last ${windowLabel}`;
  } else {
    tone = pctLower >= 75 ? "high" : "fair";
    headline = `Higher than ${pctLower}% of the last ${windowLabel}`;
  }
  return { ...base, tone, headline, pctHigher, vsTypical };
}
