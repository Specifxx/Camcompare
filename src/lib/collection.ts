// "My gear" (/collection): the cameras and lenses a visitor owns, what they
// paid, and what each is worth today, like a stock portfolio. Pure and
// client-safe: the item shape, valuation, totals, the value-over-time
// series, the plain "sell or keep" hint, local storage and the merge used
// when a signed-in member's browser list meets the synced one.
//
// Values come from public/values/<market>.json (scripts/build-values.ts):
// the typical used price (lib/value.ts usedValue, the same number as "Should
// be worth" on product pages), else the lowest new price. Everything stays
// in the item's own market currency: totals are per currency, never
// converted, and an item is valued only in the market it was priced in.
import { MARKET_CODES, MARKETS, money, type Currency, type MarketCode } from "./markets";

export const GEAR_CONDITIONS = [
  { slug: "new", label: "New, unopened" },
  { slug: "like-new", label: "Like new" },
  { slug: "good", label: "Good" },
  { slug: "worn", label: "Well used" },
  { slug: "parts", label: "Faulty / for parts" },
] as const;
export type GearCondition = (typeof GEAR_CONDITIONS)[number]["slug"];
export const GEAR_CONDITION_SLUGS = GEAR_CONDITIONS.map((c) => c.slug) as [GearCondition, ...GearCondition[]];
export const conditionLabel = (s: string) => GEAR_CONDITIONS.find((c) => c.slug === s)?.label ?? s;

export const COLLECTION_MAX = 300;
export const GEAR_NOTES_MAX = 300;
/** Price paid ceiling, minor units (10 million in any currency): past it, it's a typo. */
export const PAID_MAX = 1_000_000_000;
export const GEAR_ID_RE = /^[a-z0-9][a-z0-9-]{7,39}$/;

export type GearItem = {
  /** Made in the browser (a UUID), so lists from two devices can merge. */
  id: string;
  slug: string;
  /** The market it was priced in: price paid is in its currency, and it is valued there. */
  market: MarketCode;
  condition: GearCondition;
  /** Minor units (cents) of the market's currency, or null when not given. */
  paid: number | null;
  /** YYYY-MM-DD, or null. */
  bought: string | null;
  notes: string;
  updatedAt: string;
};

/** public/values/<market>.json: per slug [typical used, lowest new], minor units. */
export type ValuesFile = { currency: Currency; day: string | null; p: Record<string, [number | null, number | null]> };
/** public/values/<market>/<slug>.json: the estimated value on past days, oldest first. */
export type SeriesFile = { currency: Currency; s: [string, number][] };

export type Estimate = { value: number | null; basis: "used" | "new" | null };

/**
 * Today's estimate: the typical used price, else the lowest new price. Gear
 * marked faulty gets none (a working camera's price would flatter it). The
 * condition otherwise doesn't change the number: we don't guess discounts.
 */
export function estimate(item: Pick<GearItem, "slug" | "condition">, values: ValuesFile | null | undefined): Estimate {
  if (item.condition === "parts" || !values) return { value: null, basis: null };
  const [used, low] = values.p[item.slug] ?? [null, null];
  if (used !== null) return { value: used, basis: "used" };
  if (low !== null) return { value: low, basis: "new" };
  return { value: null, basis: null };
}

/** Gain or loss against the price paid; null without both numbers. */
export function gainOf(paid: number | null, value: number | null): { abs: number; pct: number | null } | null {
  if (paid === null || value === null) return null;
  return { abs: value - paid, pct: paid > 0 ? Math.round(((value - paid) / paid) * 1000) / 10 : null };
}

export type CurrencyTotal = { currency: Currency; markets: MarketCode[]; items: number; valued: number; value: number; paidOfValued: number; paidAll: number; gain: number | null; pct: number | null };

/** Totals per currency. Gain compares value with what was paid, over items that have both. */
export function totals(items: GearItem[], values: Partial<Record<MarketCode, ValuesFile>>): CurrencyTotal[] {
  const by = new Map<Currency, CurrencyTotal & { both: number; paidBoth: number; valueBoth: number }>();
  for (const it of items) {
    const cur = MARKETS[it.market].currency;
    const t = by.get(cur) ?? by.set(cur, { currency: cur, markets: [], items: 0, valued: 0, value: 0, paidOfValued: 0, paidAll: 0, gain: null, pct: null, both: 0, paidBoth: 0, valueBoth: 0 }).get(cur)!;
    if (!t.markets.includes(it.market)) t.markets.push(it.market);
    t.items++;
    if (it.paid !== null) t.paidAll += it.paid;
    const e = estimate(it, values[it.market]);
    if (e.value === null) continue;
    t.valued++;
    t.value += e.value;
    if (it.paid !== null) {
      t.both++;
      t.paidBoth += it.paid;
      t.valueBoth += e.value;
      t.paidOfValued += it.paid;
    }
  }
  return [...by.values()].map(({ both, paidBoth, valueBoth, ...t }) => {
    const g = both ? gainOf(paidBoth, valueBoth) : null;
    return { ...t, gain: g?.abs ?? null, pct: g?.pct ?? null };
  });
}

/**
 * The plain "sell or keep" line for one item, or null. Said only when it is
 * true from our numbers: the typical used price has risen above what they
 * paid. We never say "sell" off a new price (that isn't what it would fetch).
 */
export function sellHint(item: Pick<GearItem, "paid" | "market">, e: Estimate): string | null {
  if (item.paid === null || item.paid <= 0 || e.value === null || e.basis !== "used") return null;
  const cur = MARKETS[item.market].currency;
  const diff = e.value - item.paid;
  if (diff <= 0) return null;
  const pct = Math.round((diff / item.paid) * 100);
  return `Its typical used price (${money(e.value, cur, true)}) is now ${money(diff, cur, true)} above what you paid${pct >= 1 ? ` (+${pct}%)` : ""}. If it sits on a shelf, selling now would get all your money back and more, before fees.`;
}

/** The value of `s` on `day`: its last point on or before that day, or null. */
function valueOn(s: [string, number][], day: string): number | null {
  let v: number | null = null;
  for (const [d, x] of s) {
    if (d > day) break;
    v = x;
  }
  return v;
}

export type SeriesPoint = { day: string; value: number; paid: number };

/**
 * The collection's value on each day any of its products has a point, in
 * one currency: each item counts from the day it was bought (all along when
 * no date is given), at its product's value that day. `paid` is what the
 * counted items cost, for the "paid" line under the chart.
 */
export function portfolioSeries(items: GearItem[], series: Record<string, SeriesFile | undefined>): SeriesPoint[] {
  const valued = items.filter((it) => it.condition !== "parts" && series[it.slug]?.s.length);
  const days = [...new Set(valued.flatMap((it) => series[it.slug]!.s.map(([d]) => d)))].sort();
  const out: SeriesPoint[] = [];
  for (const day of days) {
    let value = 0;
    let paid = 0;
    let any = false;
    for (const it of valued) {
      if (it.bought && it.bought > day) continue;
      const v = valueOn(series[it.slug]!.s, day);
      if (v === null) continue;
      any = true;
      value += v;
      paid += it.paid ?? 0;
    }
    if (any) out.push({ day, value, paid });
  }
  return out;
}

// ---------------------------------------------------------------- input

/** "1,299.50", "£1299", "1299" → minor units; "" → null; nonsense → undefined. */
export function parsePaid(raw: string): number | null | undefined {
  const s = raw.replace(/[\s,£$€]|A\$|S\$/g, "");
  if (!s) return null;
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(s)) return undefined;
  const v = Math.round(Number(s) * 100);
  return v <= PAID_MAX ? v : undefined;
}

export const isIsoDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

export function newGearId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `g${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Keeps the well-formed items only (local storage can hold anything), newest edit per id. */
export function cleanItems(raw: unknown, known: (slug: string) => boolean = () => true): GearItem[] {
  if (!Array.isArray(raw)) return [];
  const out = new Map<string, GearItem>();
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const it = x as Record<string, unknown>;
    if (typeof it.id !== "string" || !GEAR_ID_RE.test(it.id) || typeof it.slug !== "string" || !known(it.slug)) continue;
    if (typeof it.market !== "string" || !(MARKET_CODES as readonly string[]).includes(it.market)) continue;
    if (typeof it.condition !== "string" || !(GEAR_CONDITION_SLUGS as readonly string[]).includes(it.condition)) continue;
    const paid = typeof it.paid === "number" && Number.isInteger(it.paid) && it.paid >= 0 && it.paid <= PAID_MAX ? it.paid : null;
    const item: GearItem = {
      id: it.id,
      slug: it.slug,
      market: it.market as MarketCode,
      condition: it.condition as GearCondition,
      paid,
      bought: isIsoDay(it.bought) ? it.bought : null,
      notes: typeof it.notes === "string" ? it.notes.slice(0, GEAR_NOTES_MAX) : "",
      updatedAt: typeof it.updatedAt === "string" ? it.updatedAt : new Date(0).toISOString(),
    };
    const prev = out.get(item.id);
    if (!prev || prev.updatedAt < item.updatedAt) out.set(item.id, item);
    if (out.size >= COLLECTION_MAX) break;
  }
  return [...out.values()];
}

/** Two lists of the same collection: every id from either, the newer edit winning. */
export function mergeCollections(a: GearItem[], b: GearItem[]): GearItem[] {
  return cleanItems([...a, ...b]).sort((x, y) => (x.bought ?? "").localeCompare(y.bought ?? "") || x.id.localeCompare(y.id));
}

// ---------------------------------------------------------------- local storage

const KEY = "cc_gear_v1";
/** Which member this browser's list last synced with ("" = never): decides merge or replace at sign-in. */
const SYNC_KEY = "cc_gear_synced_v1";

export function readLocalGear(): GearItem[] {
  try {
    return cleanItems(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
  } catch {
    return [];
  }
}
export function writeLocalGear(items: GearItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, COLLECTION_MAX)));
  } catch {
    /* storage blocked: the list lasts this visit only */
  }
}
export function localSyncedWith(): string {
  try {
    return localStorage.getItem(SYNC_KEY) ?? "";
  } catch {
    return "";
  }
}
export function setLocalSyncedWith(username: string): void {
  try {
    localStorage.setItem(SYNC_KEY, username);
  } catch {
    /* ignore */
  }
}

/**
 * What a signed-in member's list becomes when this page loads: a browser
 * that already synced with them takes the account's list as it is (so a
 * deletion on another device sticks); a browser that never did adds its
 * items to the account's once.
 */
export function resolveSync(local: GearItem[], remote: GearItem[], syncedWith: string, username: string): { items: GearItem[]; push: boolean } {
  if (syncedWith === username) return { items: remote, push: false };
  if (!local.length) return { items: remote, push: false };
  const items = mergeCollections(remote, local);
  return { items, push: true };
}
