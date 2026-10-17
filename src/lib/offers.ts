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
  prices: z.record(z.object({ new: z.number().int().optional(), used: z.number().int().optional() })),
});
export type HistoryDay = z.infer<typeof historyDaySchema>;
export type HistoryPoint = { day: string; new?: number; used?: number };

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
