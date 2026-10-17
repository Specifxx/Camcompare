// The home page's "best deals" list (views/HomeView.tsx): what George, a
// friend of the owner and the kind of buyer the site is for, asked for:
// "price at recommended retail minus the second-hand price found on
// CamCompare". Pure arithmetic over one market's offers and its RRP.
import { lowest, type Offer } from "./offers";
import type { Condition } from "./retailers";

export type HomeDealInput = {
  slug: string;
  kind: "camera" | "lens";
  offers: Offer[];
  /** This market's launch RRP in minor units of the market's currency, or null when we don't know it. */
  rrpMinor: number | null;
};

export type HomeDeal = {
  slug: string;
  kind: "camera" | "lens";
  /** The condition the deal is in: "used", "refurbished", "open-box" or "new". */
  condition: Condition;
  price: number;
  rrp: number;
  save: number;
  pct: number;
  retailer: string;
  /** The cheapest new price (used mode) or used price (new mode) beside it, if any. */
  other: number | null;
};

/**
 * Products ranked by how much the cheapest in-stock, body-only, non-Amazon
 * offer (`lowest`) in `mode` saves against this market's RRP: biggest saving
 * in money first, then biggest percent. Products without an RRP are skipped,
 * so is a saving under `minPct` percent, and each product appears once.
 */
export function homeDeals(items: HomeDealInput[], mode: "used" | "new", opts: { minPct?: number; max?: number; kind?: "camera" | "lens" } = {}): HomeDeal[] {
  const { minPct = 5, max = 24, kind } = opts;
  const best = new Map<string, HomeDeal>();
  for (const it of items) {
    if (kind && it.kind !== kind) continue;
    const rrp = it.rrpMinor;
    if (!rrp || rrp <= 0) continue;
    const o = lowest(it.offers, mode);
    if (!o || o.price >= rrp) continue;
    const save = rrp - o.price;
    const pct = Math.round((save / rrp) * 100);
    if (pct < minPct) continue;
    const other = lowest(it.offers, mode === "used" ? "new" : "used")?.price ?? null;
    const d: HomeDeal = { slug: it.slug, kind: it.kind, condition: o.condition, price: o.price, rrp, save, pct, retailer: o.retailer, other };
    const prev = best.get(it.slug);
    if (!prev || rank(d, prev) < 0) best.set(it.slug, d);
  }
  return [...best.values()].sort(rank).slice(0, max);
}

const rank = (a: HomeDeal, b: HomeDeal) => b.save - a.save || b.pct - a.pct || a.price - b.price || a.slug.localeCompare(b.slug);

/**
 * One list per view for the home page's tabs, rendered once: the union of the
 * top `max` overall, top `max` cameras and top `max` lenses, in rank order,
 * each flagged with whether it makes the overall top `max`. Every camera in
 * the overall top is also in the camera top, so hiding by kind (or by
 * `inAll`) in CSS shows exactly each view's list, in order.
 */
export function homeDealViews(items: HomeDealInput[], mode: "used" | "new", max = 24, minPct = 5): (HomeDeal & { inAll: boolean })[] {
  const all = homeDeals(items, mode, { max, minPct });
  const top = new Set(all.map((d) => d.slug));
  const union = new Map<string, HomeDeal>();
  for (const d of [...all, ...homeDeals(items, mode, { max, minPct, kind: "camera" }), ...homeDeals(items, mode, { max, minPct, kind: "lens" })]) union.set(d.slug, d);
  return [...union.values()].sort(rank).map((d) => ({ ...d, inAll: top.has(d.slug) }));
}
