// Derived facts shown on product pages. Everything here is arithmetic over
// the catalog and our own price history — no opinions, no scores.
import type { Camera } from "./catalog/schema";
import { publishedCameras } from "./catalog";
import { convert, type Fx } from "./fx";
import { MARKET_CODES, MARKETS, type Currency, type MarketCode } from "./markets";
import { isAmazonOffer, lowest, type HistoryPoint, type Offer } from "./offers";
import { sensorLabel, typeLabel } from "./specs/definitions";

type Metric = { key: string; label: string; phrase: string; better: "higher" | "lower"; get: (c: Camera) => number | null; unit: (v: number) => string };

const METRICS: Metric[] = [
  { key: "megapixels", label: "resolution", phrase: "more resolution than", better: "higher", get: (c) => c.specs.megapixels, unit: (v) => `${v} MP` },
  { key: "burst", label: "burst speed", phrase: "faster bursts than", better: "higher", get: (c) => Math.max(c.specs.burstMechFps ?? 0, c.specs.burstElecFps ?? 0) || null, unit: (v) => `${v} fps` },
  { key: "weight", label: "weight", phrase: "lighter than", better: "lower", get: (c) => c.specs.weightG, unit: (v) => `${v} g` },
  { key: "battery", label: "battery life", phrase: "longer battery life than", better: "higher", get: (c) => c.specs.batteryShotsCipa, unit: (v) => `${v} shots` },
  { key: "ibis", label: "stabilisation", phrase: "more stabilisation than", better: "higher", get: (c) => (c.specs.ibis ? c.specs.ibisStops : null), unit: (v) => `${v} stops` },
  { key: "evf", label: "viewfinder resolution", phrase: "a sharper viewfinder than", better: "higher", get: (c) => c.specs.evfDotsM, unit: (v) => `${v}M dots` },
];

export type PeerRank = { label: string; phrase: string; value: string; pct: number; better: "higher" | "lower"; peers: number; group: string };

/**
 * Where a camera sits among its peers (same sensor size and type), metric by
 * metric: "lighter than 80% of full-frame mirrorless cameras". Only metrics
 * where the camera and at least 8 peers have a value; strongest first.
 */
export function peerRanks(c: Camera, minPeers = 8): PeerRank[] {
  const peers = publishedCameras().filter((p) => p.slug !== c.slug && p.type === c.type && p.specs.sensorFormat === c.specs.sensorFormat);
  const group = `${sensorLabel(c.specs.sensorFormat).toLowerCase()} ${typeLabel(c.type).toLowerCase()} cameras`;
  const out: PeerRank[] = [];
  for (const m of METRICS) {
    const v = m.get(c);
    if (v === null) continue;
    const values = peers.map(m.get).filter((x): x is number => x !== null);
    if (values.length < minPeers) continue;
    const beaten = values.filter((x) => (m.better === "higher" ? x < v : x > v)).length;
    out.push({ label: m.label, phrase: m.phrase, value: m.unit(v), pct: Math.round((beaten / values.length) * 100), better: m.better, peers: values.length, group });
  }
  return out.sort((a, b) => b.pct - a.pct);
}

export type DealSignal = { kind: "low-90" | "below-avg" | "above-avg"; text: string } | null;

/**
 * How today's lowest new price compares with our own history in this market
 * before `today` (the import day, whose history point is today's own price).
 * Needs two weeks of history; says nothing rather than guess. "Lowest" means
 * below every earlier price: a flat price is not a deal.
 */
export function dealSignal(history: HistoryPoint[], todayMinor: number | null, field: "new" | "used" = "new", today?: string | null): DealSignal {
  if (todayMinor === null) return null;
  const pts = history.filter((p) => p[field] !== undefined && (!today || p.day < today)).slice(-90);
  if (pts.length < 14) return null;
  const vals = pts.map((p) => p[field]!);
  const min90 = Math.min(...vals);
  const last30 = vals.slice(-30);
  const avg30 = last30.reduce((a, b) => a + b, 0) / last30.length;
  const days = Math.round((Date.parse(today ?? pts[pts.length - 1].day) - Date.parse(pts[0].day)) / 86400_000) + 1;
  if (todayMinor < min90) return { kind: "low-90", text: `Lowest ${field} price we've seen in ${days} days` };
  const pct = Math.round(((avg30 - todayMinor) / avg30) * 100);
  if (pct >= 3) return { kind: "below-avg", text: `${pct}% below its 30-day average` };
  if (pct <= -3) return { kind: "above-avg", text: `${-pct}% above its 30-day average` };
  return null;
}

/** Used price as a share of new: how much buying used saves today. */
export function usedSaving(newMinor: number | null, usedMinor: number | null): number | null {
  if (newMinor === null || usedMinor === null || usedMinor >= newMinor) return null;
  return Math.round(((newMinor - usedMinor) / newMinor) * 100);
}

/** Today's price against the launch list price (both in the same currency). */
export function vsLaunch(todayMinor: number | null, launch: number | null): number | null {
  if (todayMinor === null || !launch) return null;
  return Math.round(((todayMinor / 100 - launch) / launch) * 100);
}

/**
 * Biggest drops this week: the lowest price on the market's latest history
 * day against the same product's 7 to 10 days earlier. A product not priced
 * on the latest day is left out: its last price is no longer on sale.
 */
export function priceDrops(history: Map<string, HistoryPoint[]>, field: "new" | "used", minPct = 3): { slug: string; from: number; to: number; pct: number }[] {
  const out: { slug: string; from: number; to: number; pct: number }[] = [];
  const latest = [...history.values()].reduce((d, pts) => (pts.length && pts[pts.length - 1].day > d ? pts[pts.length - 1].day : d), "");
  const ago = (p: HistoryPoint) => (Date.parse(latest) - Date.parse(p.day)) / 86400_000;
  for (const [slug, pts] of history) {
    const withVal = pts.filter((p) => p[field] !== undefined);
    const last = withVal[withVal.length - 1];
    if (!last || last.day !== latest) continue;
    const before = [...withVal].reverse().find((p) => ago(p) >= 7);
    if (!before || ago(before) > 10) continue;
    const pct = Math.round(((before[field]! - last[field]!) / before[field]!) * 100);
    if (pct >= minPct) out.push({ slug, from: before[field]!, to: last[field]!, pct });
  }
  return out.sort((a, b) => b.pct - a.pct);
}

// ------------------------------------------------------------ top bargains

export type BargainInput = { slug: string; offers: Offer[]; rrpMinor: number | null; usedTypicalMinor: number | null };
export type Bargain = { slug: string; condition: "new" | "used"; price: number; ref: number; pct: number; retailer: string };

/**
 * Today's biggest bargains in one market. New: the cheapest new offer against
 * this market's launch RRP, biggest % under first. Used: the cheapest used or
 * refurbished offer against the typical used price (lib/value.ts). Only
 * in-stock, body-only, non-Amazon offers count (`lowest`), and only a saving
 * of at least `minPct`.
 */
export function topBargains(items: BargainInput[], field: "new" | "used", minPct = 5, max = 12): Bargain[] {
  const out: Bargain[] = [];
  for (const it of items) {
    const ref = field === "new" ? it.rrpMinor : it.usedTypicalMinor;
    if (!ref || ref <= 0) continue;
    const o = lowest(it.offers, field);
    if (!o || o.price >= ref) continue;
    const pct = Math.round(((ref - o.price) / ref) * 100);
    if (pct < minPct) continue;
    out.push({ slug: it.slug, condition: field, price: o.price, ref, pct, retailer: o.retailer });
  }
  return out.sort((a, b) => b.pct - a.pct || a.price - b.price || a.slug.localeCompare(b.slug)).slice(0, max);
}

// ------------------------------------------------------------ price around the world

export type WorldRow = {
  market: MarketCode;
  currency: Currency;
  new: number | null; // minor units, the market's own currency
  used: number | null;
  /** The same, converted approximately into the page market's currency (minor units). */
  newHere: number | null;
  usedHere: number | null;
};

/** Each market's lowest new and used price, with an approximate conversion into `here`'s currency. */
export function worldRows(offersByMarket: Record<MarketCode, Offer[]>, here: MarketCode, fx: Fx): WorldRow[] {
  const to = MARKETS[here].currency;
  return MARKET_CODES.map((m) => {
    const cur = MARKETS[m].currency;
    const n = lowest(offersByMarket[m] ?? [], "new")?.price ?? null;
    const u = lowest(offersByMarket[m] ?? [], "used")?.price ?? null;
    const conv = (v: number | null) => (v === null ? null : cur === to ? v : Math.round(convert(v, cur, to, fx)));
    return { market: m, currency: cur, new: n, used: u, newHere: conv(n), usedHere: conv(u) };
  });
}

const ADJ: Record<MarketCode, string> = { us: "US", uk: "UK", eu: "European", au: "Australian", sg: "Singapore" };

export type WorldVerdict = { field: "new" | "used"; cheapest: MarketCode; here: MarketCode; pct: number | null; text: string };

/**
 * Where it is cheapest, converted at today's rate, against this market:
 * "Cheapest in Australia: about 12% under the US price". New prices decide;
 * used ones only when fewer than two markets price it new. Needs two markets.
 * A gap under 2% is called "about the same".
 */
export function worldVerdict(rows: WorldRow[], here: MarketCode): WorldVerdict | null {
  for (const field of ["new", "used"] as const) {
    const key = field === "new" ? "newHere" : "usedHere";
    const priced = rows.filter((r) => r[key] !== null);
    if (priced.length < 2) continue;
    const best = priced.reduce((a, b) => (b[key]! < a[key]! ? b : a));
    const mine = rows.find((r) => r.market === here)?.[key] ?? null;
    const place = (m: MarketCode) => (m === "us" ? "the US" : m === "uk" ? "the UK" : m === "eu" ? "Europe" : MARKETS[m].name);
    const label = field === "new" ? "" : " used";
    if (mine === null) return { field, cheapest: best.market, here, pct: null, text: `Cheapest${label} in ${place(best.market)}. Not priced${label} in ${place(here)} yet.` };
    if (best.market === here) {
      const next = priced.filter((r) => r.market !== here).reduce((a, b) => (b[key]! < a[key]! ? b : a));
      const pct = Math.round(((next[key]! - mine) / next[key]!) * 100);
      return { field, cheapest: here, here, pct, text: pct < 2 ? `About the same${label} price in ${place(here)} as in ${place(next.market)}, the next cheapest.` : `Cheapest${label} right here in ${place(here)}: about ${pct}% under the price in ${place(next.market)}, the next cheapest.` };
    }
    const pct = Math.round(((mine - best[key]!) / mine) * 100);
    if (pct < 2) return { field, cheapest: best.market, here, pct, text: `About the same${label} price in ${place(here)} as anywhere else we track.` };
    return { field, cheapest: best.market, here, pct, text: `Cheapest${label} in ${place(best.market)}: about ${pct}% under the ${ADJ[here]} price before shipping and import tax.` };
  }
  return null;
}

export type StoreGap = { slug: string; best: Offer; next: Offer; pct: number };

/**
 * One store clearly under every other in stock today: the cheapest new,
 * body-only, in-stock offer against the cheapest at a DIFFERENT store, as a
 * percentage of that next price. Needs no RRP or history, so every market
 * with two stores carrying a product has some (the deal lists' fallback, and
 * what lets every market vote on deals). Amazon is left out, as in all deals.
 */
export function storeGaps(items: { slug: string; offers: Offer[] }[], minPct = 5, max = 12): StoreGap[] {
  const out: StoreGap[] = [];
  for (const { slug, offers } of items) {
    const byStore = new Map<string, Offer>();
    for (const o of offers) {
      if (!o.inStock || o.kit || o.condition !== "new" || isAmazonOffer(o)) continue;
      const had = byStore.get(o.retailer);
      if (!had || o.price < had.price) byStore.set(o.retailer, o);
    }
    const [best, next] = [...byStore.values()].sort((a, b) => a.price - b.price);
    if (!best || !next) continue;
    const pct = Math.round(((next.price - best.price) / next.price) * 100);
    if (pct >= minPct) out.push({ slug, best, next, pct });
  }
  return out.sort((a, b) => b.pct - a.pct || a.slug.localeCompare(b.slug)).slice(0, max);
}
