// Prices live in files, not a database (RiftCompare, DECISIONS 2026-09-11 and
// 2026-10-03: a Neon free tier died every few days under per-request price
// reads and per-deploy prerenders; as committed JSON the same data costs no
// transfer at all). The daily import (scripts/import-prices.ts, run by
// .github/workflows/refresh-prices.yml) writes:
//   data/offers/latest.json            every live offer, replaced each run
//   data/price-history/YYYY-MM-DD.json the day's lowest new and used price per camera
// and pages read them at build time.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { CONDITIONS, type Condition } from "./retailers";

const DATA = path.join(process.cwd(), "data");
export const OFFERS_FILE = path.join(DATA, "offers", "latest.json");
export const HISTORY_DIR = path.join(DATA, "price-history");

/** An offer is dropped if its source has not confirmed it for this long (RiftCompare's STORE_ROWS_MAX_AGE_H). */
export const OFFER_MAX_AGE_H = 72;

export const offerSchema = z.object({
  camera: z.string(),
  retailer: z.string(),
  condition: z.enum(CONDITIONS as [Condition, ...Condition[]]),
  priceCents: z.number().int().positive(),
  currency: z.literal("USD"),
  url: z.string().url(), // the retailer's own product URL; affiliate wrapping happens at render
  title: z.string(),
  seller: z.string().nullable(), // marketplace seller, null for the retailer itself
  inStock: z.boolean(),
  kit: z.boolean(), // body plus lens: shown, never counted as the body price
  seenAt: z.string(),
  sourceId: z.string().nullable(),
});
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
  market: z.literal("US"),
  sources: z.record(sourceRunSchema),
  offers: z.array(offerSchema),
});
export type OffersFile = z.infer<typeof offersFileSchema>;

export const historyDaySchema = z.object({
  day: z.string(),
  currency: z.literal("USD"),
  prices: z.record(z.object({ new: z.number().int().optional(), used: z.number().int().optional() })),
});
export type HistoryDay = z.infer<typeof historyDaySchema>;

export const EMPTY_OFFERS: OffersFile = { generatedAt: null, market: "US", sources: {}, offers: [] };

export function readOffersFile(file = OFFERS_FILE): OffersFile {
  if (!fs.existsSync(file)) return EMPTY_OFFERS;
  return offersFileSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
}

export function readHistory(dir = HISTORY_DIR): HistoryDay[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .map((f) => historyDaySchema.parse(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))));
}

/** Body-only offers sorted cheapest first; kits last. */
export function sortOffers(offers: Offer[]): Offer[] {
  return [...offers].sort((a, b) => Number(a.kit) - Number(b.kit) || Number(b.inStock) - Number(a.inStock) || a.priceCents - b.priceCents);
}

/** The headline number: cheapest in-stock body-only offer in the condition group. */
export function lowest(offers: Offer[], group: "new" | "used"): Offer | null {
  const ok = offers.filter((o) => !o.kit && o.inStock && (group === "new" ? o.condition === "new" : o.condition !== "new"));
  return ok.reduce<Offer | null>((best, o) => (!best || o.priceCents < best.priceCents ? o : best), null);
}

