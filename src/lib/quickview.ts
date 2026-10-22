// The quick view: a product card's plain left click opens every store's
// price for it in a dialog instead of navigating (owner, 2026-10-17: "when
// you click an item it pops up, and then you can see all the rows and compare
// all the prices between all the stores"). Its data is one static file per
// market and product, public/offers/<market>/<slug>.json, written by
// scripts/build-public-data.ts with every link already affiliate-wrapped
// (lib/offer-rows.ts), so the browser fetches a file and nothing else.
// Client-safe: types and URL helpers only.
import type { Highlight } from "./highlights";
import type { Currency, MarketCode } from "./markets";

/** One priced offer, ready to show: the same row on the product page and in the quick view. */
export type OfferRow = {
  id: string;
  retailer: string; // retailer key
  name: string; // "B&H Photo"
  condition: string; // "New", "Used", "Open box", "Refurbished"
  price: number; // minor units of `currency`
  currency: Currency;
  href: string; // already through affiliateUrl, with a sub-id
  paid: boolean; // isPaid(retailer, href): filled button and "Paid link"
  inStock: boolean;
  kit: boolean;
  pack: string | null; // "Body only", "With lens"; null where it means nothing
  seller: string | null; // marketplace seller
  authorized: boolean | null; // the retailer is an authorized dealer here
  variant: string | null; // lens mount version: "Sony E"
  /** Amazon's time, so its price can hide itself after 24 hours. Never in a public file. */
  seenAt?: string;
  amazon?: boolean;
  /** The tab a row belongs to: "new", "used" (used and open box) or "refurb". */
  cond?: RowCond;
  /** The store's own struck-through price, minor units, when it is above `price`. */
  was?: number;
  /** Stock beyond in/out, when the source says (low stock, preorder, backorder). */
  avail?: "low_stock" | "preorder" | "backorder";
  promo?: string; // the store's bonus or promotion, as it words it
  detail?: string; // variant, branch or grade: what tells two listings apart
  image?: string; // a second-hand listing's own photo, small, from the store's CDN (ACCESSORY_IMAGES)
  /** A kit's lens: "RF-S 18-45mm". The kit is labelled even when it is unknown. */
  kitLens?: string;
  /** Identical listings (same store, condition, price, stock and detail) merged into one row. */
  count?: number;
  /** The page's headline offers (lib/price-rules.ts): "best" new, cheapest "used", the headline or cheapest new "kit". */
  tag?: "best" | "used" | "kit";
};

export type RowCond = "new" | "used" | "refurb";

/** A store whose price we can't show yet (Amazon before its API, eBay before its keys): a tagged link. */
export type CheckLink = {
  retailer: string;
  name: string;
  href: string;
  paid: boolean;
  note: string;
  cta: string;
};

export type QuickViewData = {
  slug: string;
  kind: "camera" | "lens";
  market: MarketCode;
  currency: Currency;
  name: string;
  brandName: string;
  subline: string;
  href: string; // the product page in this market
  highlights: Highlight[];
  rows: OfferRow[]; // every store's offer except Amazon's and eBay's, cheapest first
  ebay: { name: string; listings: OfferRow[]; all: CheckLink | null } | null; // live eBay listings, when there are any
  alsoCheck: CheckLink[];
  updated: string | null; // when this market's offers were imported
  mounts: number; // a lens made in several mount versions
  /** This market's launch RRP and the typical used price, minor units: the header line and the rows' warnings. */
  rrp?: number | null;
  usedTypical?: number | null;
  /** Today's cheapest used, minor units, for "Used from" when there is no typical value yet. */
  lowestUsed?: number | null;
  /** The headline (lib/price-rules.ts): body-only new, else used, else a kit, labelled. Same rule as the product page. */
  from?: { price: number; what: "new" | "used" | "kit"; label?: string } | null;
  lowestNew?: number | null;
};

export const QUICKVIEW_PARAM = "view";

/** The product slug a URL's query opens in the quick view, if a sane one. */
export function viewParam(search: string): string | null {
  const v = new URLSearchParams(search).get(QUICKVIEW_PARAM);
  return v && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) ? v : null;
}

/** The same path and query with ?view set (or removed, for null); other keys stay. */
export function withView(path: string, search: string, hash: string, slug: string | null): string {
  const sp = new URLSearchParams(search);
  if (slug) sp.set(QUICKVIEW_PARAM, slug);
  else sp.delete(QUICKVIEW_PARAM);
  const qs = sp.toString().replace(/%2C/g, ",");
  return `${path}${qs ? `?${qs}` : ""}${hash}`;
}

export const quickViewFile = (m: MarketCode, slug: string) => `/offers/${m}/${slug}.json`;

/**
 * The attributes that make a link open the quick view on a plain left click
 * (QuickViewHost listens for them). Its href stays the product page, for
 * crawlers, middle-click, new tabs, and before the script has loaded.
 */
export const quickViewAttrs = (slug: string, m: MarketCode, name: string) => ({ "data-qv": slug, "data-qv-market": m, "data-qv-name": name });
