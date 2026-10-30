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
import { accessoryImageUrl } from "./accessory-format";
import { affiliateUrl, isPaid, subId } from "./affiliate";
import { asinFor } from "./amazon-asins";
import { brandName, displayName, historyFor, launchPrice, offersGeneratedAt, offersFor, type AnyProduct } from "./catalog";
import { cameraHighlights, cardSubline, lensHighlights } from "./highlights";
import { MARKETS, marketPath, type MarketCode } from "./markets";
import { isAmazonOffer, lowest, sortOffers, type Offer } from "./offers";
import { usedValue } from "./value";
import { headline, kitLensLabel, kitText, leadOffer, lowestKit, percentOff } from "./price-rules";
import type { CheckLink, OfferRow, QuickViewData, RowCond } from "./quickview";
import { CONDITION_LABEL, ebayFor, retailer, retailersFor } from "./retailers";
import { productEbayCategory, productEbayLinks } from "./ebay-links";
import { summarizeCamera, summarizeLens } from "./summary";

const MOUNT_SHORT: Record<string, string> = {
  "sony-e": "Sony E", "canon-rf": "Canon RF", "canon-ef": "Canon EF", "canon-ef-m": "Canon EF-M", "nikon-z": "Nikon Z", "nikon-f": "Nikon F",
  "fujifilm-x": "Fujifilm X", "fujifilm-g": "Fujifilm G", "l-mount": "L-Mount", "micro-four-thirds": "MFT", "pentax-k": "Pentax K", "leica-m": "Leica M",
};

/** What an offer's `kit` means for this product: a body with a mount is "Body only" or a kit with a lens. */
export type PackKind = "body" | "fixed" | "lens";
export const packKind = (p: AnyProduct): PackKind => (p.kind === "lens" ? "lens" : p.item.mount ? "body" : "fixed");
function packLabel(o: Offer, k: PackKind): string | null {
  if (o.kit) return kitText(o, k);
  return k === "body" ? "Body only" : null;
}

const COND: Record<Offer["condition"], RowCond> = { new: "new", "open-box": "used", used: "used", refurbished: "refurb" };

export type RowContext = { page: string; placement: string; pack: PackKind; tags?: Map<Offer, NonNullable<OfferRow["tag"]>> };

/** The page's headline offers, tagged on their rows (lib/price-rules.ts): the same rule as the hero, cards and metadata. */
export function rowTags(offers: Offer[], withAmazon: boolean): Map<Offer, NonNullable<OfferRow["tag"]>> {
  const h = headline(offers, withAmazon);
  // The hero's kit when there is no body price; else the cheapest new kit, for the Kits filter.
  const kit = h.kit ?? lowestKit(offers, "new", withAmazon);
  const t = new Map<Offer, NonNullable<OfferRow["tag"]>>();
  if (kit) t.set(kit, "kit");
  if (h.used) t.set(h.used, "used");
  if (h.new) t.set(h.new, "best");
  return t;
}

export function toRow(o: Offer, ctx: RowContext): OfferRow {
  const r = retailer(o.retailer);
  // A feed or eBay link may already carry the affiliate id the import ran with.
  const href = affiliateUrl(o.retailer, o.url, subId(ctx.page, ctx.placement));
  const amazon = isAmazonOffer(o);
  const kitLens = o.kit ? kitLensLabel(o, ctx.pack) : null;
  const was = o.wasPrice && percentOff(o.price, o.wasPrice) !== null ? o.wasPrice : null;
  const avail = o.inStock && o.availability && o.availability !== "in_stock" && o.availability !== "out_of_stock" ? o.availability : null;
  const tag = ctx.tags?.get(o);
  // Second-hand units differ, so their row shows the listing's own photo.
  const image = o.condition !== "new" ? accessoryImageUrl(o.image) : null;
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
    pack: packLabel(o, ctx.pack),
    seller: o.seller,
    authorized: r?.authorized ?? null,
    variant: o.mount ? MOUNT_SHORT[o.mount] ?? null : null,
    cond: COND[o.condition],
    // Optional detail only when a source gave it, so the public files stay small.
    ...(was ? { was } : {}),
    ...(avail ? { avail } : {}),
    ...(o.promo ? { promo: o.promo } : {}),
    ...(o.detail ? { detail: o.detail } : {}),
    ...(image ? { image } : {}),
    ...(kitLens ? { kitLens } : {}),
    ...(tag ? { tag } : {}),
    ...(amazon ? { amazon: true, seenAt: o.seenAt } : {}),
  };
}

/**
 * Identical listings, one row: the same store, condition, price, stock,
 * pack, seller, mount version, detail, promotion and was-price (a store
 * listing the black and the silver body at one price, or one shop's two
 * branches with no branch named). The row says "×N listings" and links to
 * the first. Different prices or details stay apart.
 */
export function mergeKey(o: Offer, pack: PackKind): string {
  return [o.retailer, o.condition, o.price, o.inStock, o.kit, o.kit ? kitLensLabel(o, pack) ?? "" : "", o.seller ?? "", o.mount ?? "", o.detail ?? "", o.promo ?? "", o.wasPrice ?? "", o.condition !== "new" ? o.image ?? "" : ""].join("|");
}

function mergeRows(sorted: Offer[], ctx: RowContext): OfferRow[] {
  const out: OfferRow[] = [];
  const at = new Map<string, number>();
  for (const o of sorted) {
    const k = mergeKey(o, ctx.pack);
    const i = at.get(k);
    if (i === undefined) {
      at.set(k, out.length);
      out.push(toRow(o, ctx));
      continue;
    }
    const row = out[i];
    row.count = (row.count ?? 1) + 1;
    const tag = ctx.tags?.get(o);
    if (tag && !row.tag) row.tag = tag;
  }
  return out;
}

/** Priced rows, eBay apart, identical listings merged. Amazon's only with `withAmazon` (the product page, shown live). */
export function offerRows(offers: Offer[], ctx: RowContext & { withAmazon: boolean }): OfferRow[] {
  const c = { ...ctx, tags: ctx.tags ?? rowTags(offers, ctx.withAmazon) };
  return mergeRows(sortOffers(offers.filter((o) => !retailer(o.retailer)?.ebay && (ctx.withAmazon || !isAmazonOffer(o)))), c);
}

/** Up to four live eBay listings in this market, in stock, cheapest first. */
export function ebayRows(offers: Offer[], m: MarketCode, ctx: RowContext, max = 4): OfferRow[] {
  const r = ebayFor(m);
  if (!r) return [];
  // Tagged as the product page does (Amazon live); the quick view passes its own tags.
  const c = { ...ctx, tags: ctx.tags ?? rowTags(offers, true) };
  return offers
    .filter((o) => o.retailer === r.key && o.inStock)
    .sort((a, b) => a.price - b.price)
    .slice(0, max)
    .map((o) => toRow(o, c));
}

export type CheckInput = { product: string; query: string; offers: Offer[]; market: MarketCode; page: string; amazonAsin?: string; placement: string; amazonShown: boolean; /** false where the "On eBay" card has its own searches (product page, quick view). */ ebay?: boolean };

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
  if (r && x.ebay !== false && !x.offers.some((o) => o.retailer === r.key && o.inStock)) {
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

/** The quick view's "From" line: the same headline as the product page, without Amazon (a public file never stores its price). */
export function fromLine(offers: Offer[], pack: PackKind): QuickViewData["from"] {
  const lead = leadOffer(headline(offers, false));
  if (!lead) return null;
  return { price: lead.offer.price, what: lead.what, ...(lead.what === "kit" ? { label: kitText(lead.offer, pack) } : {}) };
}

export function quickViewData(p: AnyProduct, m: MarketCode, offers: Offer[] = offersFor(p.item.slug, m), updated: string | null = offersGeneratedAt(m)): QuickViewData {
  const slug = p.item.slug;
  const page = `qv-${m}-${slug}`;
  const pack = packKind(p);
  const query = retailerQuery(p, m);
  const tags = rowTags(offers, false);
  const listings = ebayRows(offers, m, { page, placement: "quickview-ebay", pack, tags });
  const eb = ebayFor(m);
  const ebLinks = productEbayLinks(query, displayName(p.item, m).replace(/α/g, "a"), m, page, "qv", productEbayCategory(p.kind === "camera" ? p.item.type : null));
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
    rows: offerRows(offers, { page, placement: "quickview", pack, withAmazon: false, tags }),
    // Always where eBay has a programme: live listings when there are some, and the used and sold searches.
    ebay: eb && ebLinks ? { name: eb.name, listings, all: listings.length ? ebaySearch(query, m, page, "qv-ebay-all", listings) : null, used: ebLinks.used, sold: ebLinks.sold } : null,
    alsoCheck: alsoCheckLinks({ product: slug, query, offers, market: m, page, amazonAsin: p.item.amazonAsin, placement: "quickview-check", amazonShown: false, ebay: false }),
    updated,
    mounts: p.kind === "lens" ? p.item.mounts.length : 1,
    rrp: rrpMinor(p, m),
    usedTypical: usedValue(historyFor(slug, m))?.value ?? null,
    lowestUsed: lowest(offers, "used")?.price ?? null,
    lowestNew: lowest(offers, "new")?.price ?? null,
    from: fromLine(offers, pack),
  };
}
