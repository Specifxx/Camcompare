// The deals card's products (components/DealsPopup.tsx; owner, 2026-11-28: "the sites without TCGplayer … eBay or Amazon
// pop-ups, especially with Black Friday deals … with actual products"). Computed once per market at build and served as one
// static file per market (/deal-picks/<market>, force-static), like the ad tiles (lib/side-rails.ts):
//
//   • Amazon first: products of OUR catalogue (Amazon's exception for pop-ups promoting "Products closely associated with the
//     materials on your Site") with a new, in-stock Amazon offer this build fetched (scripts/fetch-amazon-prices.ts), with its
//     fetch time; the browser drops it after 24 hours (Amazon's licence). A link to that item only, never a deals page.
//   • eBay to fill: the import's own new eBay listings for the products the most shops list, with our own photo.
//   • Nothing is invented: no "was" price, no saving of ours, no countdown. Server-only: reads data/ at build.
import { affiliateUrl, subId } from "./affiliate";
import { displayName, offersFor } from "./catalog";
import { MARKETS, money, type MarketCode } from "./markets";
import { isAmazonOffer, lowest } from "./offers";
import { ebayFor } from "./retailers";
import { popular } from "./side-rails";
import { thumbSrc } from "./thumb";

export const MAX_PICKS = 4;
export const MIN_PICKS = 2;

export interface DealPick {
  id: string;
  brand: "amazon" | "ebay";
  name: string;
  img: string;
  price: string;
  href: string;
  at?: string;
  deal?: string;
  off?: number;
  until?: string;
}

export interface DealPicks {
  region: string;
  picks: DealPick[];
  clock: { timeZone: string; label: string } | null;
}

const CLOCK: Partial<Record<MarketCode, { timeZone: string; label: string }>> = {
  us: { timeZone: "America/New_York", label: "New York time" },
  uk: { timeZone: "Europe/London", label: "London time" },
  eu: { timeZone: "Europe/Berlin", label: "Berlin time" },
  au: { timeZone: "Australia/Sydney", label: "Sydney time" },
};

const cache = new Map<MarketCode, DealPicks>();

export function dealPicksFor(m: MarketCode): DealPicks {
  const hit = cache.get(m);
  if (hit) return hit;
  const products = popular(m);
  const cur = MARKETS[m].currency;
  const picks: DealPick[] = [];
  for (const p of products) {
    if (picks.length >= 2) break;
    const o = offersFor(p.slug, m).filter((x) => isAmazonOffer(x) && x.condition === "new" && x.inStock && !x.kit).sort((a, b) => a.price - b.price)[0];
    if (!o) continue;
    picks.push({ id: p.slug, brand: "amazon", name: displayName(p, m), img: thumbSrc(p.slug), price: money(o.price, cur, true), href: affiliateUrl(o.retailer, o.url, subId(m, "deals-popup-amazon")), at: o.seenAt });
  }
  const ebay = ebayFor(m);
  if (ebay) {
    for (const p of products) {
      if (picks.length >= MAX_PICKS) break;
      if (picks.some((x) => x.id === p.slug)) continue;
      const o = lowest(offersFor(p.slug, m).filter((x) => x.retailer === ebay.key), "new");
      if (!o) continue;
      picks.push({ id: p.slug, brand: "ebay", name: displayName(p, m), img: thumbSrc(p.slug), price: money(o.price, cur, true), href: affiliateUrl(ebay.key, o.url, subId(m, "deals-popup-ebay")) });
    }
  }
  const out: DealPicks = { region: m, picks: picks.length >= MIN_PICKS ? picks : [], clock: CLOCK[m] ?? null };
  cache.set(m, out);
  return out;
}
