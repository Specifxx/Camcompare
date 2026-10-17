// "What should it be worth used?" From the used asking prices we've seen at
// the stores we track, day by day (price history usedMid/usedN). These are
// asking prices, not confirmed sales: eBay's sold data (Marketplace Insights
// API) needs eBay's approval, and it slots in here when granted.
import type { HistoryPoint } from "./offers";

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
