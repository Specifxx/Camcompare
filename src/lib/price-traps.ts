// "Price traps": a newer model that costs more today than the model it
// replaces (or rivals) does on promotion. Reviewers call the new body the
// cheaper alternative from its launch price, but at the till the older one
// can be the cheaper buy: the friends' example was the Canon R6 V at A$3.5k
// against the R6 Mark III at A$3k on promo in Australia.
// Pairs are the catalog's indexed rival pairs (both name each other, the
// /compare/<a>-vs-<b> pages) plus predecessor/successor links; prices are
// today's lowest new, in stock, body only, Amazon left out (lowest()).
import { comparePairs, indexedPairs, launchPrice, pairSlug, offersFor, product, publishedCameras, publishedLenses, type AnyProduct } from "./catalog";
import type { MarketCode } from "./markets";
import { lowest } from "./offers";

export type PriceTrap = {
  newer: { slug: string; name: string; announced: string; price: number; launch: number | null };
  older: { slug: string; name: string; announced: string; price: number; launch: number | null };
  /** How much more the newer one costs today, minor units and %. */
  diff: number;
  pct: number;
  /** The older one is under its own launch price today (by this %), i.e. on promo or discounted. */
  olderPromoPct: number | null;
  /** The newer one launched cheaper than the older one did, yet costs more today: the classic trap. */
  launchedCheaper: boolean;
  /** Where to compare them: the pair page when one exists, else the builder. */
  path: string;
};

const pairsWithSuccessors = (): [AnyProduct, AnyProduct][] => {
  const out = new Map<string, [AnyProduct, AnyProduct]>();
  for (const [a, b] of indexedPairs()) out.set([a.item.slug, b.item.slug].sort().join("|"), [a, b]);
  for (const p of [...publishedCameras(), ...publishedLenses()]) {
    const s = p.successor ? product(p.successor) : null;
    const me = product(p.slug)!;
    if (s && s.kind === me.kind) out.set([p.slug, s.item.slug].sort().join("|"), [me, s]);
  }
  return [...out.values()];
};

let pages: Set<string> | null = null;
const pairPages = () => (pages ??= new Set(comparePairs().map(([x, y]) => [x.item.slug, y.item.slug].sort().join("|"))));

/** One pair's trap in a market, or null when the newer model isn't the dearer one today. */
export function pairTrap(a: AnyProduct, b: AnyProduct, m: MarketCode, minPct = 3): PriceTrap | null {
  if (a.item.announced === b.item.announced) return null;
  const [older, newer] = a.item.announced < b.item.announced ? [a, b] : [b, a];
  const on = lowest(offersFor(newer.item.slug, m), "new");
  const oo = lowest(offersFor(older.item.slug, m), "new");
  if (!on || !oo || on.currency !== oo.currency) return null;
  const diff = on.price - oo.price;
  const pct = Math.round((diff / oo.price) * 100);
  if (diff <= 0 || pct < minPct) return null;
  const lp = (p: AnyProduct) => {
    const l = launchPrice(p.item, m);
    return l && l.currency === on.currency ? Math.round(l.amount * 100) : null;
  };
  const ln = lp(newer);
  const lo = lp(older);
  const promo = lo ? Math.round(((lo - oo.price) / lo) * 100) : null;
  return {
    newer: { slug: newer.item.slug, name: newer.item.shortName, announced: newer.item.announced, price: on.price, launch: ln },
    older: { slug: older.item.slug, name: older.item.shortName, announced: older.item.announced, price: oo.price, launch: lo },
    diff,
    pct,
    olderPromoPct: promo !== null && promo >= 3 ? promo : null,
    launchedCheaper: ln !== null && lo !== null && ln < lo,
    path: pairPages().has([a.item.slug, b.item.slug].sort().join("|")) ? `/compare/${pairSlug(a.item, b.item)}` : `/compare?c=${older.item.slug},${newer.item.slug}`,
  };
}

/** A market's traps: launched-cheaper ones first, then by how much more the newer one costs. */
export function priceTraps(m: MarketCode, max = 12): PriceTrap[] {
  return pairsWithSuccessors()
    .map(([a, b]) => pairTrap(a, b, m))
    .filter((t): t is PriceTrap => t !== null)
    .sort((x, y) => Number(y.launchedCheaper) - Number(x.launchedCheaper) || Number(y.olderPromoPct !== null) - Number(x.olderPromoPct !== null) || y.pct - x.pct)
    .slice(0, max);
}
