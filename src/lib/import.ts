// The daily price import: for each market, run its sources, merge with the
// last run, write data/offers/<market>.json and today's history file.
// Pure apart from `runImport`'s file writes, so tests drive `mergeOffers` and
// `historyFor` directly.
import fs from "node:fs";
import path from "node:path";
import { mergeAccessories, perGbHistory, type AccessoryRun } from "./accessories";
import { readAccessoriesFile, writeAccessoriesFile, writeAccessoryHistory } from "./accessory-data";
import type { Camera, Lens } from "./catalog/schema";
import { MARKETS, type MarketCode } from "./markets";
import { hasLicensedThumb } from "./images";
import { buildIndex, matchListing, otherEdition, type CatalogIndex } from "./matching";
import { writeStorePhotos } from "./store-photos";
import { AMAZON_MAX_AGE_H, historyDir, isAmazonOffer, lowest, OFFER_MAX_AGE_H, offersFile, readOffersFile, type HistoryDay, type Offer, type OffersFile, type SourceRun } from "./offers";
import { retailer } from "./retailers";
import { sourcesFor } from "./sources";
import type { PriceSource, SourceResult } from "./sources/types";

/**
 * A source that ran replaces its offers (only for the products it covered,
 * when it says which). One that FAILED keeps yesterday's — a broken feed must
 * not empty every page — until they are OFFER_MAX_AGE_H old (Amazon's,
 * AMAZON_MAX_AGE_H: its terms forbid showing an older price). One that is not
 * configured contributes nothing. A retailer this run did not include
 * (IMPORT_ONLY) keeps its offers on the same terms as a failure.
 */
export function mergeOffers(prev: OffersFile, results: Record<string, SourceResult>, now: string, slugs: Set<string>): Offer[] {
  const fresh = (o: Offer) => Date.parse(now) - Date.parse(o.seenAt) <= (retailer(o.retailer)?.amazon ? AMAZON_MAX_AGE_H : OFFER_MAX_AGE_H) * 3600_000;
  const keepPrev = (key: string, except?: Set<string>) => prev.offers.filter((o) => o.retailer === key && fresh(o) && !except?.has(o.product));
  const out: Offer[] = [];
  for (const [key, r] of Object.entries(results)) {
    if (r.status === "ok") {
      out.push(...r.offers);
      if (r.covered) out.push(...keepPrev(key, new Set(r.covered)));
    } else if (r.status === "error") out.push(...keepPrev(key));
  }
  for (const key of new Set(prev.offers.map((o) => o.retailer))) if (!(key in results) && retailer(key)) out.push(...keepPrev(key));
  // A product removed from the catalog takes its offers with it.
  return out.filter((o) => slugs.has(o.product)).sort((a, b) => a.product.localeCompare(b.product) || a.price - b.price);
}

// What a title-only re-match may refuse a stored offer for: the listing says
// it is a part, an accessory or an edition we don't list. "No alias" and the
// like are no evidence against an offer matched by its GTIN or part number.
const RECHECK_REFUSALS = /^(parts\/broken|film camera|accessory|accessories only|lens accessory|drone part|glasses part|"[^"]+": an edition)/;

/**
 * Every offer, kept or fresh, read again by today's matcher (titles only): a
 * listing it now refuses as a part, an accessory or another edition goes, and
 * one that names an edition this product is not (filed before the edition had
 * its own page) goes too, and one it reads as a bundle of the same product
 * becomes a kit. One-way: it never adds an offer, moves
 * one to another product or un-kits one.
 */
export function recheckOffers(offers: Offer[], index: CatalogIndex): Offer[] {
  const out: Offer[] = [];
  for (const o of offers) {
    const m = matchListing({ title: o.title }, index, o.kind);
    if (!m.product) {
      if (!RECHECK_REFUSALS.test(m.reason)) out.push(o);
      continue;
    }
    if (m.product.slug !== o.product) {
      // The title names an edition of this product that is its own product (a
      // "GR IV Monochrom" filed under the GR IV): not this one's price. Any
      // other disagreement may be a GTIN match with a loose title: kept.
      const stored = index.bySlug.get(o.product);
      if (!stored || !otherEdition(o.title.toLowerCase(), stored)) out.push(o);
      continue;
    }
    out.push(m.kit && !o.kit ? { ...o, kit: true } : o);
  }
  return out;
}

/** Floors, as a share of the product's median new price, under which a listing is a part or a different product. */
export const MEDIAN_FLOOR = { new: 0.5, used: 0.25 } as const;
const MEDIAN_MIN_OFFERS = 3;

/**
 * plausiblePrice holds a price against the launch price; this holds it against
 * what stores ask today. With 3+ in-stock new offers of a camera alone, a new
 * offer under half their median, or a used, open-box or refurbished one under
 * a quarter, is dropped: a part or an accessory titled with the camera's name
 * (a GO 3S Action Pod, a GR IIIx viewfinder, Zeiss ZF lenses under the Nikon
 * Zf), a scam or a used body listed as new. Kits are their own price and are
 * left alone. Lenses are not held to it: white-box and kit-split lenses sell
 * new at under half, and used kit zooms at a fifth, of the boxed price.
 */
export function dropPriceOutliers(offers: Offer[]): Offer[] {
  const newPrices = new Map<string, number[]>();
  for (const o of offers) if (o.kind === "camera" && !o.kit && o.inStock && o.condition === "new") (newPrices.get(o.product) ?? newPrices.set(o.product, []).get(o.product)!).push(o.price);
  const median = new Map<string, number>();
  for (const [slug, ps] of newPrices) {
    if (ps.length < MEDIAN_MIN_OFFERS) continue;
    const s = [...ps].sort((a, b) => a - b);
    median.set(slug, s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2);
  }
  return offers.filter((o) => {
    const m = median.get(o.product);
    if (!m || o.kit) return true;
    return o.price >= m * (o.condition === "new" ? MEDIAN_FLOOR.new : MEDIAN_FLOOR.used);
  });
}

// Run notes are committed with the offers, and a fetch error can quote the
// URL it failed on: a feed URL carries the account's credentials.
const SECRET_ENV = /^(FEED_URL_|AFFILIATE_DEEPLINK_|AMAZON_|EBAY_|BESTBUY_)/;
export function redact(note: string, env: Record<string, string | undefined> = process.env): string {
  let out = note;
  for (const [k, v] of Object.entries(env)) if (SECRET_ENV.test(k) && v && v.length >= 8) out = out.split(v).join(`[${k}]`);
  return out.replace(/https?:\/\/[^\s"')]+[?&][^\s"')]*/g, (u) => u.split("?")[0] + "?[…]");
}

export function historyFor(market: MarketCode, day: string, offers: Offer[]): HistoryDay {
  const byProduct = new Map<string, Offer[]>();
  for (const o of offers) (byProduct.get(o.product) ?? byProduct.set(o.product, []).get(o.product)!).push(o);
  const prices: HistoryDay["prices"] = {};
  for (const [slug, list] of [...byProduct].sort(([a], [b]) => a.localeCompare(b))) {
    const n = lowest(list, "new");
    const u = lowest(list, "used");
    const used = list.filter((o) => o.condition !== "new" && o.inStock && !o.kit && !isAmazonOffer(o)).map((o) => o.price).sort((a, b) => a - b);
    const mid = used.length ? (used.length % 2 ? used[(used.length - 1) / 2] : Math.round((used[used.length / 2 - 1] + used[used.length / 2]) / 2)) : null;
    if (n || u) prices[slug] = { ...(n ? { new: n.price } : {}), ...(u ? { used: u.price } : {}), ...(mid !== null ? { usedMid: mid, usedN: used.length } : {}) };
  }
  return { day, market, currency: MARKETS[market].currency, prices };
}

export async function runMarket(market: MarketCode, cameras: Camera[], lenses: Lens[], sources: PriceSource[], log = console.log): Promise<OffersFile> {
  const now = new Date().toISOString();
  const index = buildIndex(cameras, lenses);
  const prev = readOffersFile(market);
  const results: Record<string, SourceResult> = {};
  const runs: Record<string, SourceRun> = {};
  for (const s of sources) {
    const r = retailer(s.retailer);
    if (!r) continue;
    let res: SourceResult;
    try {
      res = await s.run({ market, retailer: r, cameras, lenses, index, now, prev, log });
    } catch (e) {
      res = { status: "error", note: (e as Error).message };
    }
    if (res.note) res = { ...res, note: redact(res.note).slice(0, 300) };
    results[s.retailer] = res;
    runs[s.retailer] = { status: res.status, offers: res.status === "ok" ? res.offers.length : 0, ...(res.note ? { note: res.note } : {}), at: now };
    log(`[${market}] ${s.retailer}: ${res.status}${res.status === "ok" ? ` ${res.offers.length} offers` : ""}${res.note ? ` (${res.note})` : ""}`);
  }
  const slugs = new Set([...cameras, ...lenses].map((p) => p.slug));
  const offers = dropPriceOutliers(recheckOffers(mergeOffers(prev, results, now, slugs), index));
  const file: OffersFile = { generatedAt: now, market, currency: MARKETS[market].currency, sources: { ...prev.sources, ...runs }, offers };
  fs.mkdirSync(path.dirname(offersFile(market)), { recursive: true });
  fs.writeFileSync(offersFile(market), JSON.stringify(file, null, 1) + "\n");
  const day = now.slice(0, 10);
  const history = historyFor(market, day, offers);
  if (Object.keys(history.prices).length) {
    fs.mkdirSync(historyDir(market), { recursive: true });
    fs.writeFileSync(path.join(historyDir(market), `${day}.json`), JSON.stringify(history) + "\n");
  }
  log(`[${market}] ${offers.length} offers for ${new Set(offers.map((o) => o.product)).size} products`);
  writeAccessories(market, results, now, log);
  return file;
}

/**
 * data/accessories/<market>.json and today's price-per-GB history, from the
 * listings sources passed along as accessories (src/lib/accessories.ts). A
 * source that rotates (`covered`) keeps its earlier rows it did not re-read.
 */
function writeAccessories(market: MarketCode, results: Record<string, SourceResult>, now: string, log: (m: string) => void) {
  const runs: Record<string, AccessoryRun> = {};
  for (const [k, r] of Object.entries(results)) runs[k] = r.status === "ok" ? { status: "ok", accessories: r.accessories ?? [], rotating: Boolean(r.covered) } : { status: r.status };
  const accessories = mergeAccessories(readAccessoriesFile(market).accessories, runs, now, OFFER_MAX_AGE_H, (k) => Boolean(retailer(k)));
  writeAccessoriesFile({ generatedAt: now, market, currency: MARKETS[market].currency, accessories });
  writeAccessoryHistory(market, now.slice(0, 10), perGbHistory(accessories));
  log(`[${market}] ${accessories.length} accessory listings`);
}

export async function runImport(markets: MarketCode[], cameras: Camera[], lenses: Lens[], only?: string[], log = console.log) {
  for (const m of markets) {
    const sources = sourcesFor(m).filter((s) => !only || only.includes(s.retailer));
    await runMarket(m, cameras, lenses, sources, log);
  }
  // Store photos for products without a licensed one, from every market's offers.
  log(`${writeStorePhotos(hasLicensedThumb)} store photos for products without a licensed thumbnail`);
}
