// Accessory listings and their price-per-GB history, as committed JSON like
// the offers (offers.ts): written by the price import, read by pages at build
// time.
//   data/accessories/<market>.json                    today's accessory listings
//   data/accessory-history/<market>/YYYY-MM-DD.json    the day's lowest price per GB per card/drive format and capacity
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { accessoryOfferSchema, type AccessoryOffer, type PerGbRow } from "./accessories";
import { CURRENCIES, MARKET_CODES, MARKETS, type MarketCode } from "./markets";

const DATA = path.join(process.cwd(), "data");
export const ACCESSORIES_DIR = path.join(DATA, "accessories");
export const ACCESSORY_HISTORY_DIR = path.join(DATA, "accessory-history");
export const accessoriesFile = (m: MarketCode) => path.join(ACCESSORIES_DIR, `${m}.json`);
export const accessoryHistoryDir = (m: MarketCode) => path.join(ACCESSORY_HISTORY_DIR, m);

export const accessoriesFileSchema = z.object({
  generatedAt: z.string().nullable(),
  market: z.enum(MARKET_CODES),
  currency: z.enum(CURRENCIES),
  accessories: z.array(accessoryOfferSchema),
});
export type AccessoriesFile = z.infer<typeof accessoriesFileSchema>;

const perGbRowSchema = z.object({ category: z.string(), format: z.string(), capacityGB: z.number(), lowest: z.number().int(), lowestPerGB: z.number() });
export const accessoryHistoryDaySchema = z.object({ day: z.string(), market: z.enum(MARKET_CODES), currency: z.enum(CURRENCIES), rows: z.array(perGbRowSchema) });
export type AccessoryHistoryDay = z.infer<typeof accessoryHistoryDaySchema>;

export const emptyAccessories = (m: MarketCode): AccessoriesFile => ({ generatedAt: null, market: m, currency: MARKETS[m].currency, accessories: [] });

/**
 * A row that fails the schema is dropped, never fatal: this file feeds every
 * camera page, and one bad listing must not take them down.
 */
export function readAccessoriesFile(m: MarketCode, file = accessoriesFile(m)): AccessoriesFile {
  if (!fs.existsSync(file)) return emptyAccessories(m);
  let raw: { generatedAt?: unknown; accessories?: unknown };
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return emptyAccessories(m);
  }
  const rows = Array.isArray(raw.accessories) ? raw.accessories : [];
  const accessories = rows.flatMap((r) => {
    const ok = accessoryOfferSchema.safeParse(r);
    return ok.success ? [ok.data] : [];
  });
  return { ...emptyAccessories(m), generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : null, accessories };
}

/** One listing per line: a readable diff, a file a fraction of the indented size. */
export function writeAccessoriesFile(f: AccessoriesFile, file = accessoriesFile(f.market)) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const rows = f.accessories.map((a) => " " + JSON.stringify(a)).join(",\n");
  fs.writeFileSync(file, `{"generatedAt":${JSON.stringify(f.generatedAt)},"market":"${f.market}","currency":"${f.currency}","accessories":[\n${rows}\n]}\n`);
}

export function writeAccessoryHistory(m: MarketCode, day: string, rows: PerGbRow[], dir = accessoryHistoryDir(m)) {
  if (!rows.length) return;
  fs.mkdirSync(dir, { recursive: true });
  const d: AccessoryHistoryDay = { day, market: m, currency: MARKETS[m].currency, rows };
  fs.writeFileSync(path.join(dir, `${day}.json`), JSON.stringify(d) + "\n");
}

export function readAccessoryHistory(m: MarketCode, days = 400, dir = accessoryHistoryDir(m)): AccessoryHistoryDay[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .slice(-days)
    .map((f) => accessoryHistoryDaySchema.parse(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))));
}

// Parsed once per build per market.
const memo: Partial<Record<MarketCode, AccessoriesFile>> = {};
export const marketAccessories = (m: MarketCode) => (memo[m] ??= readAccessoriesFile(m));
export const accessoriesIn = (m: MarketCode, category: string): AccessoryOffer[] => marketAccessories(m).accessories.filter((a) => a.category === category);
