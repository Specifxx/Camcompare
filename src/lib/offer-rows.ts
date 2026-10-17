// "Where to buy", built once for both places that show it: the product
// page's offers table and the quick view's public file
// (scripts/build-public-data.ts). Rows hold real prices only (owner,
// 2026-10-17: "you can't just point to a site and say check the price"):
//  - every priced offer except eBay's, in sortOffers order: in-stock body-only
//    offers cheapest first, then out of stock, then kits. Never by commission;
//  - eBay's live listings apart (single sellers, auctions, used);
//  - stores whose price we may not show yet (Amazon until its API, eBay until
//    its keys) as tagged links in an "Also check" box, never as rows.
// Amazon's price is a row only on the product page, live with its time
// (`withAmazon`); a public file never carries it (its licence: 24 hours).
// Server-only: links are wrapped with this build's affiliate ids.
import { affiliateUrl, isPaid, subId } from "./affiliate";
import { asinFor } from "./amazon-asins";
import { brandName, displayName, historyFor, launchPrice, offersGeneratedAt, offersFor, type AnyProduct } from "./catalog";
import { cameraHighlights, cardSubline, lensHighlights } from "./highlights";
import { MARKETS, marketPath, type MarketCode } from "./markets";
import { isAmazonOffer, lowest, sortOffers, type Offer } from "./offers";
import { usedValue } from "./value";
import type { CheckLink, OfferRow, QuickViewData } from "./quickview";
import { CONDITION_LABEL, ebayFor, retailer, retailersFor } from "./retailers";
import { summarizeCamera, summarizeLens } from "./summary";

const MOUNT_SHORT: Record<string, string> = {
  "sony-e": "Sony E", "canon-rf": "Canon RF", "canon-ef": "Canon EF", "canon-ef-m": "Canon EF-M", "nikon-z": "Nikon Z", "nikon-f": "Nikon F",
  "fujifilm-x": "Fujifilm X", "fujifilm-g": "Fujifilm G", "l-mount": "L-Mount", "micro-four-thirds": "MFT", "pentax-k": "Pentax K", "leica-m": "Leica M",
};

/** What an offer's `kit` means for this product: a body with a mount is "Body only" or "With lens". */
export type PackKind = "body" | "fixed" | "lens";
export const packKind = (p: AnyProduct): PackKind => (p.kind === "lens" ? "lens" : p.item.mount ? "body" : "fixed");
function packLabel(kit: boolean, k: PackKind): string | null {
  if (k === "body") return kit ? "With lens" : "Body only";
  return kit ? "Kit" : null;
}

export type RowContext = { page: string; placement: string; pack: PackKind };

export function toRow(o: Offer, ctx: RowContext): OfferRow {
  const r = retailer(o.retailer);
  // A feed or eBay link may already carry the affiliate id the import ran with.
  const href = affiliateUrl(o.retailer, o.url, subId(ctx.page, ctx.placement));
  const amazon = isAmazonOffer(o);
  return {
    id: `${o.retailer}-${o.sourceId ?? o.url}`,
    retailer: o.retailer,
    name: r?.name ?? o.retailer,
    condition: CONDITION_LABEL[o.condition],
    price: o.price,
    currency: o.currency,
    href,
    paid: isPaid(o.retailer, href),
    inStock: o.inStock,
    kit: o.kit,
    pack: packLabel(o.kit, ctx.pack),
    seller: o.seller,
    authorized: r?.authorized ?? null,
    variant: o.mount ? MOUNT_SHORT[o.mount] ?? null : null,
    ...(amazon ? { amazon: true, seenAt: o.seenAt } : {}),
  };
}

/** Priced rows, eBay apart. Amazon's only with `withAmazon` (the product page, shown live). */
export function offerRows(offers: Offer[], ctx: RowContext & { withAmazon: boolean }): OfferRow[] {
  return sortOffers(offers.filter((o) => !retailer(o.retailer)?.ebay && (ctx.withAmazon || !isAmazonOffer(o)))).map((o) => toRow(o, ctx));
}

/** Up to four live eBay listings in this market, in stock, cheapest first. */
export function ebayRows(offers: Offer[], m: MarketCode, ctx: RowContext, max = 4): OfferRow[] {
  const r = ebayFor(m);
  if (!r) return [];
  return offers
    .filter((o) => o.retailer === r.key && o.inStock)
    .sort((a, b) => a.price - b.price)
    .slice(0, max)
    .map((o) => toRow(o, ctx));
}

export type CheckInput = { product: string; query: string; offers: Offer[]; market: MarketCode; page: string; amazonAsin?: string; placement: string; amazonShown: boolean };

/** The eBay search of this market's site, tagged. */
export function ebaySearch(query: string, m: MarketCode, page: string, placement: string, listings: OfferRow[] = []): CheckLink | null {
  const r = ebayFor(m);
  if (!r?.searchUrl) return null;
  const href = affiliateUrl(r.key, r.searchUrl(query), subId(page, placement));
  return {
    retailer: r.key,
    name: r.name,
    href,
    // Listings come with the campaign the daily import ran with, even before Vercel has it.
    paid: isPaid(r.key, href) || listings.some((o) => o.paid),
    note: "New and used listings, including auctions",
    cta: listings.length ? "See all on eBay" : "Search eBay",
  };
}

/**
 * The "Also check" links: Amazon unless its price is shown (`amazonShown`),
 * then eBay's search unless live listings are shown. Nothing else: a dealer
 * without a price is not a row and not a link.
 */
export function alsoCheckLinks(x: CheckInput): CheckLink[] {
  const out: CheckLink[] = [];
  const amazon = retailersFor(x.market).find((r) => r.amazon && r.searchUrl);
  if (amazon && !x.amazonShown) {
    const asin = asinFor(x.product, amazon.amazon!.marketplace, x.amazonAsin);
    const href = affiliateUrl(amazon.key, asin ? `https://${amazon.amazon!.marketplace}/dp/${asin}` : amazon.searchUrl!(x.query), subId(x.page, x.placement));
    out.push({ retailer: amazon.key, name: amazon.name, href, paid: isPaid(amazon.key, href), note: "Amazon's price shows on Amazon", cta: "See it on Amazon" });
  }
  const r = ebayFor(x.market);
  if (r && !x.offers.some((o) => o.retailer === r.key && o.inStock)) {
    const link = ebaySearch(x.query, x.market, x.page, x.placement);
    if (link) out.push(link);
  }
  return out;
}

/** The search words for a product at retailers: its market name, "α" spelt "a". */
export const retailerQuery = (p: AnyProduct, m: MarketCode) => displayName(p.item, m).replace(/α/g, "a");

/**
 * One product's quick-view file for one market. Amazon's offers are left out
 * entirely (only a link to Amazon); every href is wrapped here, at build.
 */
/** This market's launch RRP in minor units, when the catalog has it in this currency. */
export function rrpMinor(p: AnyProduct, m: MarketCode): number | null {
  const l = launchPrice(p.item, m);
  return l && l.currency === MARKETS[m].currency ? Math.round(l.amount * 100) : null;
}

export function quickViewData(p: AnyProduct, m: MarketCode, offers: Offer[] = offersFor(p.item.slug, m), updated: string | null = offersGeneratedAt(m)): QuickViewData {
  const slug = p.item.slug;
  const page = `qv-${m}-${slug}`;
  const pack = packKind(p);
  const query = retailerQuery(p, m);
  const listings = ebayRows(offers, m, { page, placement: "quickview-ebay", pack });
  const eb = ebayFor(m);
  return {
    slug,
    kind: p.kind,
    market: m,
    currency: MARKETS[m].currency,
    name: displayName(p.item, m),
    brandName: brandName(p.item.brand),
    subline: cardSubline(p.kind === "camera" ? summarizeCamera(p.item, m) : summarizeLens(p.item, m)),
    href: marketPath(m, `/${p.kind === "camera" ? "cameras" : "lenses"}/${slug}`),
    highlights: p.kind === "camera" ? cameraHighlights(p.item) : lensHighlights(p.item),
    rows: offerRows(offers, { page, placement: "quickview", pack, withAmazon: false }),
    ebay: eb && listings.length ? { name: eb.name, listings, all: ebaySearch(query, m, page, "quickview-ebay-search", listings) } : null,
    alsoCheck: alsoCheckLinks({ product: slug, query, offers, market: m, page, amazonAsin: p.item.amazonAsin, placement: "quickview-check", amazonShown: false }),
    updated,
    mounts: p.kind === "lens" ? p.item.mounts.length : 1,
    rrp: rrpMinor(p, m),
    usedTypical: usedValue(historyFor(slug, m))?.value ?? null,
    lowestUsed: lowest(offers, "used")?.price ?? null,
  };
}
