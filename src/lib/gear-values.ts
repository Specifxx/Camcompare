// The numbers My gear (/collection) values a collection with, computed at
// build time by scripts/build-values.ts into static JSON (no database, no
// request-time read). Today's value is the typical used price (usedValue,
// the "Should be worth" figure on product pages), else the lowest new price.
// The past is sampled from price history: daily for the last DAILY_DAYS,
// weekly before that, each point computed as it would have been that day.
import type { HistoryPoint } from "./offers";
import { usedValue } from "./value";

export const DAILY_DAYS = 28;
const DAY = 86_400_000;

/** The days to sample, oldest first: daily for the last DAILY_DAYS days, every 7th day before that. */
export function sampleDays(days: string[]): string[] {
  if (!days.length) return [];
  const sorted = [...new Set(days)].sort();
  const last = Date.parse(sorted[sorted.length - 1]);
  return sorted.filter((d) => {
    const back = Math.round((last - Date.parse(d)) / DAY);
    return back < DAILY_DAYS || back % 7 === 0;
  });
}

/** A product's estimated value on `day` from its history up to then: typical used, else that day's lowest new. */
export function valueOnDay(history: HistoryPoint[], day: string): number | null {
  const upTo = history.filter((p) => p.day <= day);
  if (!upTo.length) return null;
  const used = usedValue(upTo)?.value ?? null;
  if (used !== null) return used;
  const last = upTo[upTo.length - 1];
  return last.day === day ? last.new ?? null : null;
}

/** The value series for one product over the sampled days (days without a value are left out). */
export function valueSeries(history: HistoryPoint[], days: string[]): [string, number][] {
  const out: [string, number][] = [];
  for (const d of days) {
    const v = valueOnDay(history, d);
    if (v !== null) out.push([d, v]);
  }
  return out;
}
