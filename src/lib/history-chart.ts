// The per-product price history file the browser fetches, written at build by
// scripts/build-history-data.ts into public/history/<market>/<slug>.json
// (git-ignored, served by the CDN), and read by components/PriceHistory.tsx
// and components/PairPriceHistory.tsx. The product page's HTML carries none
// of it: the chart loads it after the page renders.
// Compact on purpose (a camera with a year of days is a few KB):
//   c  the market's currency
//   s  store names, indexed by the points
//   t  today's lowest new and used, [price, store index] (Amazon left out, as in history)
//   p  [day, new, used, new store, used store, archived 0/1], oldest first;
//      a missing value is null
// Client-safe.
import type { Currency } from "./markets";
import type { ChartDay } from "./offers";

export type HistoryJson = {
  c: Currency;
  s: string[];
  t: { d: string; n: [number, number] | null; u: [number, number] | null };
  p: [string, number | null, number | null, number | null, number | null, 0 | 1][];
};

export const historyJsonPath = (market: string, slug: string) => `/history/${market}/${slug}.json`;

export type ChartToday = { day: string; new: number | null; newAt: string | null; used: number | null; usedAt: string | null };

/** Builds the file from a product's merged days (store keys → names through `name`). */
export function encodeHistory(currency: Currency, days: ChartDay[], today: { day: string; new: { price: number; store: string } | null; used: { price: number; store: string } | null }, name: (key: string) => string): HistoryJson {
  const stores: string[] = [];
  const at = (key?: string | null) => {
    if (!key) return null;
    const n = name(key);
    const i = stores.indexOf(n);
    return i >= 0 ? i : stores.push(n) - 1;
  };
  const p = days.map((d) => [d.day, d.new ?? null, d.used ?? null, at(d.newAt), at(d.usedAt), d.archived ? 1 : 0] as HistoryJson["p"][number]);
  const t = { d: today.day, n: today.new ? ([today.new.price, at(today.new.store)!] as [number, number]) : null, u: today.used ? ([today.used.price, at(today.used.store)!] as [number, number]) : null };
  return { c: currency, s: stores, t, p };
}

/** The file back into chart days (store names in newAt/usedAt) and today's prices. */
export function decodeHistory(h: HistoryJson): { currency: Currency; days: ChartDay[]; today: ChartToday } {
  const s = (i: number | null) => (i === null || i === undefined ? undefined : h.s[i]);
  const days: ChartDay[] = h.p.map(([day, n, u, na, ua, a]) => ({
    day,
    ...(n !== null ? { new: n } : {}),
    ...(u !== null ? { used: u } : {}),
    ...(s(na) ? { newAt: s(na) } : {}),
    ...(s(ua) ? { usedAt: s(ua) } : {}),
    archived: a === 1,
  }));
  const today: ChartToday = { day: h.t.d, new: h.t.n?.[0] ?? null, newAt: h.t.n ? (s(h.t.n[1]) ?? null) : null, used: h.t.u?.[0] ?? null, usedAt: h.t.u ? (s(h.t.u[1]) ?? null) : null };
  return { currency: h.c, days, today };
}
