// The archived price history's files (written by scripts/backfill-history.ts,
// lib/price-history-backfill.ts): one per product per market,
//   data/price-history-archive/<market>/<slug>.json
// each point a store's lowest new and used price on a day an archived copy
// of its page shows (Internet Archive, Common Crawl), with the snapshot's URL.
// Kept apart from data/price-history (what we recorded ourselves) and always
// labelled "From archived store pages" where it is shown.
// Only fs and zod: lib/offers.ts reads it without pulling in the matcher.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { CURRENCIES, MARKET_CODES, type MarketCode } from "./markets";

export const ARCHIVE_DIR = path.join(process.cwd(), "data", "price-history-archive");
export const archiveFile = (m: MarketCode, slug: string, dir = ARCHIVE_DIR) => path.join(dir, m, `${slug}.json`);

export const archivePointSchema = z
  .object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    new: z.number().int().positive().optional(), // minor units of the market's currency
    used: z.number().int().positive().optional(), // used, refurbished or open box
    store: z.string(), // retailer key
    source: z.literal("archive"),
    snapshotUrl: z.string().url(), // where anyone can check the number
  })
  .strict();
export type ArchivePoint = z.infer<typeof archivePointSchema>;

export const archiveFileSchema = z.object({
  slug: z.string(),
  market: z.enum(MARKET_CODES),
  currency: z.enum(CURRENCIES),
  points: z.array(archivePointSchema),
});
export type ArchiveFile = z.infer<typeof archiveFileSchema>;

/** A product's archived points in a market, or null when it has none. */
export function readArchiveFile(m: MarketCode, slug: string, dir = ARCHIVE_DIR): ArchiveFile | null {
  const f = archiveFile(m, slug, dir);
  if (!fs.existsSync(f)) return null;
  return archiveFileSchema.parse(JSON.parse(fs.readFileSync(f, "utf8")));
}

/** Every product's archived points in a market, by slug. */
export function readArchiveMarket(m: MarketCode, dir = ARCHIVE_DIR): Map<string, ArchivePoint[]> {
  const out = new Map<string, ArchivePoint[]>();
  const d = path.join(dir, m);
  if (!fs.existsSync(d)) return out;
  for (const f of fs.readdirSync(d).filter((x) => x.endsWith(".json")).sort()) {
    const a = readArchiveFile(m, f.slice(0, -5), dir);
    if (a?.points.length) out.set(a.slug, a.points);
  }
  return out;
}

/** Writes one product's file, a point per line so a diff shows what was added. */
export function writeArchiveFile(file: ArchiveFile, dir = ARCHIVE_DIR) {
  const f = archiveFile(file.market, file.slug, dir);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const body = file.points.map((p) => JSON.stringify(p)).join(",\n");
  fs.writeFileSync(f, `{"slug":${JSON.stringify(file.slug)},"market":"${file.market}","currency":"${file.currency}","points":[\n${body}\n]}\n`);
}
