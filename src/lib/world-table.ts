// The client-safe half of the global price comparison (lib/world.ts): the
// table's columns, row types and the conversion the currency picker runs in
// the browser. Converted figures are approximate and always labelled
// "≈ at today's exchange rate" (DECISIONS "Global price comparison page").
import { MARKETS, type Currency, type MarketCode } from "./markets";

/** The columns of the table, live and planned. A planned one renders only once its market exists. */
export type WorldColumn = { key: string; label: string; flag: string; currency: string; market: MarketCode | null; live: boolean };
export const WORLD_COLUMNS: WorldColumn[] = [
  { key: "us", label: "US", flag: MARKETS.us.flag, currency: "USD", market: "us", live: true },
  { key: "uk", label: "UK", flag: MARKETS.uk.flag, currency: "GBP", market: "uk", live: true },
  { key: "eu", label: "EU", flag: MARKETS.eu.flag, currency: "EUR", market: "eu", live: true },
  { key: "au", label: "Australia", flag: MARKETS.au.flag, currency: "AUD", market: "au", live: true },
  { key: "sg", label: "Singapore", flag: MARKETS.sg.flag, currency: "SGD", market: "sg", live: true },
  // Not markets yet (no retailers, no currency in lib/markets.ts).
  { key: "jp", label: "Japan", flag: "🇯🇵", currency: "JPY", market: null, live: false },
  { key: "hk", label: "Hong Kong", flag: "🇭🇰", currency: "HKD", market: null, live: false },
];
export const liveColumns = () => WORLD_COLUMNS.filter((c) => c.live && c.market);

/** One cell: a market's lowest new price today, in its own currency (minor units). */
export type WorldCell = { price: number; currency: Currency; store: string } | null;
export type WorldRow = { slug: string; path: string; name: string; listUsd: number | null; cells: Record<string, WorldCell> };
export type WorldTableData = { line: { brand: string; slug: string; name: string; blurb: string }; rows: WorldRow[]; priced: number };

/** An amount from one currency into another at `rates` (units per USD). Client-safe. */
export const convertAt = (amount: number, from: string, to: string, rates: Record<string, number>) => (amount / rates[from]) * rates[to];

/**
 * A row's cheapest market in `to` (converted), and the saving against the US
 * list price, both approximate. Null when no market prices it.
 */
export function rowBest(row: WorldRow, to: string, rates: Record<string, number>): { key: string; value: number; saving: number | null; pct: number | null } | null {
  let best: { key: string; value: number } | null = null;
  for (const [key, c] of Object.entries(row.cells)) {
    if (!c || !rates[c.currency] || !rates[to]) continue;
    const v = convertAt(c.price, c.currency, to, rates);
    if (!best || v < best.value) best = { key, value: v };
  }
  if (!best) return null;
  const list = row.listUsd ? convertAt(row.listUsd * 100, "USD", to, rates) : null;
  const saving = list !== null ? list - best.value : null;
  return { ...best, saving, pct: list && saving !== null ? Math.round((saving / list) * 100) : null };
}

