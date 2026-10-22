// Prices live in files, not a database (RiftCompare, DECISIONS 2026-09-11 and
// 2026-10-03: a Neon free tier died every few days under per-request price
// reads and per-deploy prerenders; as committed JSON the same data costs no
// transfer at all). The daily import (scripts/import-prices.ts, run by
// .github/workflows/refresh-prices.yml) writes, per market:
//   data/offers/<market>.json                  every live offer, replaced each run
//   data/price-history/<market>/YYYY-MM-DD.json the day's lowest new and used price per product
// and pages read them at build time.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { CURRENCIES, MARKET_CODES, MARKETS, type MarketCode } from "./markets";
import { ARCHIVE_DIR, readArchiveFile, type ArchivePoint } from "./price-history-archive";
import { CONDITIONS, retailer, type Condition } from "./retailers";

const DATA = path.join(process.cwd(), "data");
export const OFFERS_DIR = path.join(DATA, "offers");
export const HISTORY_DIR = path.join(DATA, "price-history");
export const offersFile = (m: MarketCode) => path.join(OFFERS_DIR, `${m}.json`);
export const historyDir = (m: MarketCode) => path.join(HISTORY_DIR, m);
/**
 * Amazon's prices are fetched by each build (scripts/fetch-amazon-prices.ts)
 * into this git-ignored folder, never committed: its API licence allows a
 * price to be kept for 24 hours, and a commit keeps it forever. Only ASINs,
 * which may be stored, go in the repo (data/amazon-asins.json).
 */
export const AMAZON_OFFERS_DIR = path.join(DATA, "offers-amazon");
export const amazonOffersFile = (m: MarketCode) => path.join(AMAZON_OFFERS_DIR, `${m}.json`);
export const isAmazonOffer = (o: Offer) => Boolean(retailer(o.retailer)?.amazon);

/** An offer is dropped if its source has not confirmed it for this long (RiftCompare's STORE_ROWS_MAX_AGE_H). */
export const OFFER_MAX_AGE_H = 72;
/** Amazon's limit: a price from its API may be shown for at most 24 hours. */
export const AMAZON_MAX_AGE_H = 24;

/** Stock beyond in/out: what a source says (Shopify tags, JSON-LD availability, feed fields). */
export const AVAILABILITY = ["in_stock", "low_stock", "preorder", "backorder", "out_of_stock"] as const;
export type Availability = (typeof AVAILABILITY)[number];

export const offerSchema = z
  .object({
    product: z.string(), // catalog slug (camera or lens)
    kind: z.enum(["camera", "lens"]),
    retailer: z.string(),
    condition: z.enum(CONDITIONS as [Condition, ...Condition[]]),
    price: z.number().int().positive(), // minor units of `currency` (cents, pence)
    currency: z.enum(CURRENCIES),
    url: z.string().url(), // the retailer's own product URL; affiliate wrapping happens at render
    title: z.string(),
    seller: z.string().nullable(), // marketplace seller, null for the retailer itself
    inStock: z.boolean(),
    kit: z.boolean(), // body plus lens: shown, never counted as the body price
    mount: z.string().nullable(), // lens version ("sony-e") when the listing says
    seenAt: z.string(),
    sourceId: z.string().nullable(),
    // Optional detail a source may know (all absent on older files). Feedback
    // round 2026-10-22: a was-price for "N% off", stock beyond in/out, the
    // kit's lens, a store's bonus or promotion, and what tells two listings
    // at the same store apart.
    wasPrice: z.number().int().positive().nullable().optional(), // the store's own struck-through price, minor units
    availability: z.enum(AVAILABILITY).nullable().optional(),
    kitLens: z.string().nullable().optional(), // catalog lens slug in a kit, when matched
    kitLensName: z.string().nullable().optional(), // "RF-S 18-45mm F4.5-6.3 IS STM", as the listing names it
    promo: z.string().max(200).nullable().optional(), // "Bonus RF 35mm F1.4 + adapter", "$250 trade-in bonus"
    detail: z.string().max(120).nullable().optional(), // variant, branch or grade: "Parramatta store", "Grade 8/10"
    // The listing's own photo, second-hand offers only (each unit differs):
    // compact like accessory photos (accessory-format.ts compactImage), hotlinked.
    image: z.string().max(400).nullable().optional(),
  })
  .strict();
export type Offer = z.infer<typeof offerSchema>;

export const sourceRunSchema = z.object({
  status: z.enum(["ok", "skipped", "error"]),
  offers: z.number().int(),
  note: z.string().optional(),
  at: z.string(),
});
export type SourceRun = z.infer<typeof sourceRunSchema>;

export const offersFileSchema = z.object({
  generatedAt: z.string().nullable(),
  market: z.enum(MARKET_CODES),
  currency: z.enum(CURRENCIES),
  sources: z.record(sourceRunSchema),
  offers: z.array(offerSchema),
});
export type OffersFile = z.infer<typeof offersFileSchema>;

export const historyDaySchema = z.object({
  day: z.string(),
  market: z.enum(MARKET_CODES),
  currency: z.enum(CURRENCIES),
  // usedMid/usedN: median and count of that day's used and refurbished asking
  // prices (in stock, body only, Amazon left out), for the "should be worth"
  // value. Days written before 2026-10-17 lack them.
  prices: z.record(z.object({ new: z.number().int().optional(), used: z.number().int().optional(), usedMid: z.number().int().optional(), usedN: z.number().int().optional() })),
});
export type HistoryDay = z.infer<typeof historyDaySchema>;
export type HistoryPoint = { day: string; new?: number; used?: number; usedMid?: number; usedN?: number };

export const emptyOffers = (m: MarketCode): OffersFile => ({ generatedAt: null, market: m, currency: MARKETS[m].currency, sources: {}, offers: [] });

export function readOffersFile(m: MarketCode, file = offersFile(m)): OffersFile {
  if (!fs.existsSync(file)) return emptyOffers(m);
  return offersFileSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
}

/** This build's Amazon prices (scripts/fetch-amazon-prices.ts), if it fetched any. */
export function readAmazonOffers(m: MarketCode, file = amazonOffersFile(m)): Offer[] {
  if (!fs.existsSync(file)) return [];
  return z.object({ offers: z.array(offerSchema) }).parse(JSON.parse(fs.readFileSync(file, "utf8"))).offers;
}

/**
 * Pages show at most this many days of history. The folder grows by one file
 * a day per market, and a page should never read more than a year and a bit
 * (a year's low still needs a year of points).
 */
export const HISTORY_DAYS = 400;

export function readHistory(m: MarketCode, dir = historyDir(m), days = HISTORY_DAYS): HistoryDay[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .slice(-days)
    .map((f) => historyDaySchema.parse(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))));
}

/**
 * One day of a product's chart: what we recorded ourselves (`archived`
 * false), or the lowest an archived copy of a store's page showed that day
 * (`archived` true, from data/price-history-archive via
 * lib/price-history-archive.ts; DECISIONS "Price history backfill from
 * archived store pages"). `newAt`/`usedAt`: the store, when known.
 */
export type ChartDay = { day: string; new?: number; used?: number; newAt?: string; usedAt?: string; archived: boolean };

/** A product's archived points in a market (empty when it has none). */
export function readArchivedHistory(m: MarketCode, slug: string, dir = ARCHIVE_DIR): ArchivePoint[] {
  return readArchiveFile(m, slug, dir)?.points ?? [];
}

/**
 * Recorded and archived history as one series of days, archived days
 * labelled. Archived points become each day's lowest across stores; a day we
 * recorded ourselves always wins over an archived one.
 */
export function mergeArchivedHistory(live: HistoryPoint[], archived: ArchivePoint[]): ChartDay[] {
  const by = new Map<string, ChartDay>();
  for (const a of archived) {
    const d = by.get(a.day) ?? by.set(a.day, { day: a.day, archived: true }).get(a.day)!;
    if (a.new !== undefined && (d.new === undefined || a.new < d.new)) Object.assign(d, { new: a.new, newAt: a.store });
    if (a.used !== undefined && (d.used === undefined || a.used < d.used)) Object.assign(d, { used: a.used, usedAt: a.store });
  }
  for (const p of live) {
    if (p.new === undefined && p.used === undefined) continue;
    by.set(p.day, { day: p.day, ...(p.new !== undefined ? { new: p.new } : {}), ...(p.used !== undefined ? { used: p.used } : {}), archived: false });
  }
  return [...by.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Body-only offers cheapest first; kits and out-of-stock last. */
export function sortOffers(offers: Offer[]): Offer[] {
  return [...offers].sort((a, b) => Number(a.kit) - Number(b.kit) || Number(b.inStock) - Number(a.inStock) || a.price - b.price);
}

/**
 * The headline number: cheapest in-stock body-only offer in the condition
 * group. Amazon's price counts only where it is shown live with its time
 * (`withAmazon`, the price box); never in history, deals, metadata,
 * structured data or the price files, which would store it.
 */
export function lowest(offers: Offer[], group: "new" | "used", withAmazon = false): Offer | null {
  const ok = offers.filter((o) => !o.kit && o.inStock && (withAmazon || !isAmazonOffer(o)) && (group === "new" ? o.condition === "new" : o.condition !== "new"));
  return ok.reduce<Offer | null>((best, o) => (!best || o.price < best.price ? o : best), null);
}
