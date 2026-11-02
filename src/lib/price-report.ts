// The self-updating monthly price report (DECISIONS.md, "Self-updating price report", 2026-11-02): the page outreach
// offers camera writers to quote, built with the site from the committed prices, so nobody writes it. Pure:
// tests/price-report.test.ts. Amazon and kits are left out, like every "lowest" on the site.
import { isAmazonOffer, lowest, type Offer } from "./offers";

export interface MarketReport {
  /** Retailers with an in-stock new body or lens. */
  stores: number;
  /** Products with an in-stock new price. */
  newPriced: number;
  /** Products two or more retailers sell new, in stock. */
  compared: number;
  /** Median gap between the cheapest and dearest new price, as a share of the dearest (0..1). */
  medianGap: number | null;
  /** Products with both an in-stock new and used/refurbished price. */
  usedCompared: number;
  /** Median saving of the cheapest second-hand price under the cheapest new one (0..1). */
  medianUsedSaving: number | null;
}

export function medianOf(xs: number[]): number | null {
  if (!xs.length) return null;
  const v = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function marketReport(perProduct: Offer[][]): MarketReport {
  const stores = new Set<string>();
  const gaps: number[] = [];
  const used: number[] = [];
  let newPriced = 0;
  for (const offers of perProduct) {
    const fresh = offers.filter((o) => !o.kit && o.inStock && !isAmazonOffer(o) && o.condition === "new");
    if (!fresh.length) continue;
    newPriced++;
    const byStore = new Map<string, number>();
    for (const o of fresh) {
      stores.add(o.retailer);
      byStore.set(o.retailer, Math.min(byStore.get(o.retailer) ?? Infinity, o.price));
    }
    if (byStore.size >= 2) {
      const ps = [...byStore.values()];
      const hi = Math.max(...ps);
      gaps.push((hi - Math.min(...ps)) / hi);
    }
    const n = lowest(offers, "new");
    const u = lowest(offers, "used");
    if (n && u && u.price < n.price) used.push((n.price - u.price) / n.price);
  }
  return { stores: stores.size, newPriced, compared: gaps.length, medianGap: medianOf(gaps), usedCompared: used.length, medianUsedSaving: medianOf(used) };
}

export const pctText = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);
