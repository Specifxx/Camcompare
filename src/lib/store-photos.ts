// "Unofficial images" (owner, 2026-10-22: unofficial images are fine): a
// catalog camera or lens with no licensed thumbnail (public/products/<slug>.webp
// with its credit, docs/images.md) shows a store's own listing photo of it
// instead, hotlinked small from the store's CDN, credited "Image: <store>".
//
//   data/store-photos.json   slug → { src, store, retailer }
//
// Written by the price import from the offers' `image` fields (sources
// capture a new offer's photo only for products without a licensed one).
// next.config.js turns each entry into a redirect from /products/<slug>.webp
// to the store's photo, so every card, quick view, picker, OG and JSON-LD
// image that uses the thumbnail path gets it with no change, and nothing is
// copied. A licensed photo always wins: entries are dropped at build for any
// product that has one. ACCESSORY_IMAGES (accessory-format.ts) turns them off.
import fs from "node:fs";
import path from "node:path";
import { ACCESSORY_IMAGES, accessoryImageUrl } from "./accessory-format";
import { MARKET_CODES } from "./markets";
import { isAmazonOffer, readOffersFile, type Offer } from "./offers";
import { retailer } from "./retailers";

export const STORE_PHOTOS_FILE = path.join(process.cwd(), "data", "store-photos.json");
export const STORE_PHOTO_PX = 640; // the licensed thumbnails' width (images.ts THUMB_WIDTH)

export type StorePhoto = { src: string; store: string; retailer: string };

/**
 * Clean product shots first: a maker's own store, then an authorized dealer,
 * then any other store. Lower is better.
 */
function storeRank(key: string): number {
  const r = retailer(key);
  if (!r) return 9;
  if (r.shopify?.brand || /-store(-|$)/.test(key)) return 0;
  return r.authorized ? 1 : 2;
}

/**
 * Per product without a licensed photo, the best store photo: a new,
 * body-only (not a kit), in-stock, non-Amazon offer with an image. Never a
 * second-hand listing's photo: that is one unit, not the product.
 */
export function pickStorePhotos(offers: Offer[], hasLicensed: (slug: string) => boolean): Record<string, StorePhoto> {
  const best = new Map<string, { o: Offer; rank: number }>();
  for (const o of offers) {
    if (!o.image || o.condition !== "new" || o.kit || !o.inStock || isAmazonOffer(o) || hasLicensed(o.product)) continue;
    const rank = storeRank(o.retailer);
    const prev = best.get(o.product);
    if (!prev || rank < prev.rank || (rank === prev.rank && `${o.retailer}|${o.sourceId ?? o.url}` < `${prev.o.retailer}|${prev.o.sourceId ?? prev.o.url}`)) best.set(o.product, { o, rank });
  }
  const out: Record<string, StorePhoto> = {};
  for (const slug of [...best.keys()].sort()) {
    const { o } = best.get(slug)!;
    const src = accessoryImageUrl(o.image, STORE_PHOTO_PX);
    if (src) out[slug] = { src, store: retailer(o.retailer)?.name ?? o.retailer, retailer: o.retailer };
  }
  return out;
}

/** After an import: every market's offers → data/store-photos.json (sorted, no timestamp, so an unchanged run changes nothing). */
export function writeStorePhotos(hasLicensed: (slug: string) => boolean, file = STORE_PHOTOS_FILE) {
  const offers = MARKET_CODES.flatMap((m) => readOffersFile(m).offers);
  const photos = ACCESSORY_IMAGES ? pickStorePhotos(offers, hasLicensed) : {};
  fs.writeFileSync(file, JSON.stringify({ photos }, null, 1) + "\n");
  return Object.keys(photos).length;
}

let memo: Record<string, StorePhoto> | null = null;

/** The store photos pages may use: none when ACCESSORY_IMAGES is off. Callers drop products with a licensed photo. */
export function readStorePhotos(file = STORE_PHOTOS_FILE): Record<string, StorePhoto> {
  if (memo && file === STORE_PHOTOS_FILE) return memo;
  let photos: Record<string, StorePhoto> = {};
  if (ACCESSORY_IMAGES && fs.existsSync(file)) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { photos?: Record<string, StorePhoto> };
      for (const [slug, p] of Object.entries(raw.photos ?? {})) if (p && typeof p.src === "string" && /^https:\/\//.test(p.src) && typeof p.store === "string") photos[slug] = { src: p.src, store: p.store, retailer: String(p.retailer ?? "") };
    } catch {
      photos = {};
    }
  }
  if (file === STORE_PHOTOS_FILE) memo = photos;
  return photos;
}
