// The side rails' tiles (components/SideRails.tsx draws them; owner, 2026-11-06: "the eBay ads … and instead of the TCGplayer
// ad, the Amazon ad banner that's scrollable", as on DexCompare and MTG Compare), computed once per market at build and served
// as one static file per market (/rails/<market>, force-static): no page carries them and a visit never runs a function.
//
//   • Left, eBay: the daily import's own eBay Browse offers for the bodies and lenses the most shops in the market list today,
//     the cheapest new body-only listing (else used, labelled), with our own product photo. subId cc-<market>-side-ebay.
//   • Right, Amazon: the same products as tagged links to Amazon's page of the item when its ASIN is known
//     (data/amazon-asins.json, the catalogue's amazonAsin), else an exact product-name search (Associates: a specific product,
//     never a category). NO price: the rails file is served for a day, and Amazon's licence allows a price only for 24 hours
//     from its fetch with its time shown, which the product page's own row does. No Amazon rail in Singapore (no tag).
//   • Never in the phone dock (an overlay: Associates' rule), never in an email, never counted as a store.
import { affiliateUrl, amazonTag, subId } from "./affiliate";
import { asinFor } from "./amazon-asins";
import { displayName, offersFor, publishedCameras, publishedLenses } from "./catalog";
import { MARKETS, money, type MarketCode } from "./markets";
import { isAmazonOffer, lowest } from "./offers";
import { ebayFor, retailersFor } from "./retailers";
import { thumbSrc } from "./thumb";

export const MAX_TILES = 10;
export const MIN_TILES = 2;

export interface RailTile {
  id: string;
  name: string;
  img: string;
  /** formatted (eBay only; Amazon tiles never carry a price) */
  price: string | null;
  /** "Used" when the eBay tile's listing is not new */
  note?: string;
  href: string;
}

export interface Rails {
  market: MarketCode;
  ebay: { label: string; tiles: RailTile[] };
  amazon: { label: string; tiles: RailTile[] } | null;
}

/** The bodies and lenses the most shops in the market list today: two bodies, then a lens, so the rail is mostly cameras. */
function popular(m: MarketCode) {
  const rank = <T extends { slug: string }>(items: T[]) =>
    items
      .map((item) => ({ item, shops: new Set(offersFor(item.slug, m).filter((o) => o.inStock && !o.kit && !isAmazonOffer(o)).map((o) => o.retailer)).size }))
      .filter((x) => x.shops >= 1)
      .sort((a, b) => b.shops - a.shops || a.item.slug.localeCompare(b.item.slug))
      .map((x) => x.item);
  const cams = rank(publishedCameras());
  const lenses = rank(publishedLenses());
  const out: (typeof cams[number] | typeof lenses[number])[] = [];
  for (let i = 0, j = 0; i < cams.length || j < lenses.length; ) {
    if (i < cams.length) out.push(cams[i++]);
    if (i < cams.length) out.push(cams[i++]);
    if (j < lenses.length) out.push(lenses[j++]);
  }
  return out;
}

const cache = new Map<MarketCode, Rails>();

export function railsFor(m: MarketCode): Rails {
  const hit = cache.get(m);
  if (hit) return hit;
  const products = popular(m);
  const cur = MARKETS[m].currency;

  const ebay = ebayFor(m);
  const ebayTiles: RailTile[] = [];
  if (ebay) {
    for (const p of products) {
      const offers = offersFor(p.slug, m).filter((o) => o.retailer === ebay.key);
      const o = lowest(offers, "new") ?? lowest(offers, "used");
      if (!o) continue;
      ebayTiles.push({
        id: p.slug,
        name: displayName(p, m),
        img: thumbSrc(p.slug),
        price: money(o.price, cur, true),
        ...(o.condition !== "new" ? { note: "Used" } : {}),
        href: affiliateUrl(ebay.key, o.url, subId(m, "side-ebay")),
      });
      if (ebayTiles.length >= MAX_TILES) break;
    }
  }

  let amazon: Rails["amazon"] = null;
  const az = retailersFor(m).find((r) => r.amazon && r.searchUrl);
  if (az && amazonTag(az.key)) {
    const seen = new Set(ebayTiles.map((t) => t.id));
    const tiles: RailTile[] = [];
    for (const p of [...products.filter((p) => !seen.has(p.slug)), ...products.filter((p) => seen.has(p.slug))]) {
      const name = displayName(p, m);
      const asin = asinFor(p.slug, az.amazon!.marketplace, p.amazonAsin);
      tiles.push({ id: p.slug, name, img: thumbSrc(p.slug), price: null, href: affiliateUrl(az.key, asin ? `https://${az.amazon!.marketplace}/dp/${asin}` : az.searchUrl!(name), subId(m, "side-amazon")) });
      if (tiles.length >= MAX_TILES) break;
    }
    amazon = { label: az.name, tiles };
  }

  const rails: Rails = { market: m, ebay: { label: ebay?.name ?? "eBay", tiles: ebayTiles }, amazon };
  cache.set(m, rails);
  return rails;
}
