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
  const bases = (raw as { imageBases?: unknown }).imageBases;
  const accessories = rows.flatMap((r) => {
    const ok = accessoryOfferSchema.safeParse(unpackImage(r, bases));
    return ok.success ? [ok.data] : [];
  });
  return { ...emptyAccessories(m), generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : null, accessories };
}

// Shopify image paths start with the shop's own id ("~1/0603/4083/0375/files/x.jpg"),
// the same on every row of a retailer: the file stores it once per retailer
// (`imageBases`) and the rows as "~/files/x.jpg". Read expands it back, so
// nothing else sees the difference.
const SHOP_BASE = /^~(\d+\/\d{4}\/\d{4}\/\d{4}\/)/;

/** Rows with their retailer's Shopify image base taken out, and the bases. Exported for tests. */
export function packImages(rows: AccessoryOffer[]): { rows: AccessoryOffer[]; bases: Record<string, string> } {
  const seen = new Map<string, Set<string>>();
  for (const a of rows) {
    const m = a.image?.match(SHOP_BASE);
    if (m) (seen.get(a.retailer) ?? seen.set(a.retailer, new Set()).get(a.retailer)!).add(m[1]);
  }
  const bases: Record<string, string> = {};
  for (const [r, set] of seen) if (set.size === 1) bases[r] = [...set][0];
  return { rows: rows.map((a) => (a.image && bases[a.retailer] && a.image.startsWith(`~${bases[a.retailer]}`) ? { ...a, image: `~/${a.image.slice(1 + bases[a.retailer].length)}` } : a)), bases };
}

function unpackImage(r: unknown, bases: unknown): unknown {
  if (!r || typeof r !== "object") return r;
  const row = r as { image?: unknown; retailer?: unknown };
  if (typeof row.image !== "string" || !row.image.startsWith("~/")) return r;
  const base = bases && typeof bases === "object" && typeof row.retailer === "string" ? (bases as Record<string, unknown>)[row.retailer] : undefined;
  if (typeof base !== "string") {
    const { image: _drop, ...rest } = row; // a base gone missing: no photo, never a wrong one
    return rest;
  }
  return { ...row, image: `~${base}${row.image.slice(2)}` };
}

/** One listing per line: a readable diff, a file a fraction of the indented size. */
export function writeAccessoriesFile(f: AccessoriesFile, file = accessoriesFile(f.market)) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const packed = packImages(f.accessories);
  const rows = packed.rows.map((a) => " " + JSON.stringify(a)).join(",\n");
  const bases = Object.keys(packed.bases).length ? `,"imageBases":${JSON.stringify(packed.bases)}` : "";
  fs.writeFileSync(file, `{"generatedAt":${JSON.stringify(f.generatedAt)},"market":"${f.market}","currency":"${f.currency}"${bases},"accessories":[\n${rows}\n]}\n`);
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
