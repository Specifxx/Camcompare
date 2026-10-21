// Accessory listings as the rows pages render: sorted by price, links
// wrapped (affiliateUrl + subId), `paid` decided, names resolved. Server only.
import { accessoryBrandName, accessoryCategory, CATEGORIES, formatLabel, perGB, type AccessoryOffer, type AccessorySpecs } from "./accessories";
import { specLine } from "./accessory-format";
import { accessoriesIn, marketAccessories } from "./accessory-data";
import { affiliateUrl, isPaid, subId } from "./affiliate";
import { brandName, camera, displayShortName } from "./catalog";
import { MARKETS, type Currency, type MarketCode } from "./markets";
import { CONDITION_LABEL, retailer } from "./retailers";

export type AccessoryRow = {
  id: string;
  title: string;
  category: string;
  brand: string | null;
  brandName: string | null;
  cameras: string[];
  cameraBrands: string[];
  specs: AccessorySpecs;
  format: string | null;
  formatName: string | null;
  spec: string;
  perGB: number | null; // minor units per GB
  retailer: string;
  retailerName: string;
  condition: string;
  price: number;
  currency: Currency;
  href: string;
  paid: boolean;
  inStock: boolean;
};

export const rowSort = (a: { inStock: boolean; price: number }, b: { inStock: boolean; price: number }) => Number(b.inStock) - Number(a.inStock) || a.price - b.price;

export function accessoryRows(list: AccessoryOffer[], m: MarketCode, page: string, placement: string): AccessoryRow[] {
  const sub = subId(page, placement);
  return [...list].sort(rowSort).map((a, i) => {
    const href = affiliateUrl(a.retailer, a.url, sub);
    const fl = formatLabel(a.category, a.specs.format);
    return {
      id: `${a.retailer}-${a.sourceId ?? i}-${i}`,
      title: a.title,
      category: a.category,
      brand: a.brand,
      brandName: accessoryBrandName(a.brand),
      cameras: a.cameras.filter((s) => camera(s)),
      cameraBrands: a.cameraBrands,
      specs: a.specs,
      format: a.specs.format ?? null,
      formatName: fl,
      spec: specLine(a.specs, fl),
      perGB: perGB(a),
      retailer: a.retailer,
      retailerName: retailer(a.retailer)?.name ?? a.retailer,
      condition: CONDITION_LABEL[a.condition],
      price: a.price,
      currency: MARKETS[m].currency,
      href,
      paid: isPaid(a.retailer, href),
      inStock: a.inStock,
    };
  });
}

export type CategorySummary = { slug: string; label: string; group: string; count: number; low: number | null; high: number | null; brands: number };

/** Per category: listings, in-stock price range, accessory brands. Only categories with listings, unless `all`. */
export function categorySummaries(m: MarketCode, all = false): CategorySummary[] {
  const rows = marketAccessories(m).accessories;
  return CATEGORIES.map((c) => {
    const list = rows.filter((a) => a.category === c.slug);
    const prices = list.filter((a) => a.inStock).map((a) => a.price);
    return { slug: c.slug, label: c.label, group: c.group, count: list.length, low: prices.length ? Math.min(...prices) : null, high: prices.length ? Math.max(...prices) : null, brands: new Set(list.map((a) => a.brand).filter(Boolean)).size };
  }).filter((s) => all || s.count > 0);
}

export const categoryIndexable = (category: string) => (m: MarketCode) => accessoriesIn(m, category).length > 0;
export const accessoriesIndexable = (m: MarketCode) => marketAccessories(m).accessories.length > 0;

/** Names for the camera filter: slug → "α7 IV", and brand slug → "Sony". */
export function cameraNames(rows: AccessoryRow[], m: MarketCode) {
  const cams: Record<string, { name: string; brand: string }> = {};
  for (const r of rows) for (const s of r.cameras) {
    const c = camera(s);
    if (c && !cams[s]) cams[s] = { name: `${brandName(c.brand)} ${displayShortName(c, m)}`, brand: c.brand };
  }
  const brands: Record<string, string> = {};
  for (const r of rows) for (const b of r.cameraBrands) brands[b] = brandName(b);
  return { cams, brands };
}

/**
 * A camera page's block: per category, the cheapest in-stock listing that
 * names this camera, then (flashes, triggers, batteries…) the cheapest for
 * its maker's system when nothing names the model.
 */
export function accessoriesForCamera(slug: string, m: MarketCode) {
  const c = camera(slug);
  if (!c) return [];
  const all = marketAccessories(m).accessories.filter((a) => a.inStock);
  const out: { category: string; label: string; one: string; row: AccessoryRow; count: number; forModel: boolean }[] = [];
  const ranked = CATEGORIES.filter((d) => d.cameraRank !== undefined).sort((a, b) => a.cameraRank! - b.cameraRank!);
  const others = CATEGORIES.filter((d) => d.cameraRank === undefined && !["film", "memory-cards", "storage", "cables"].includes(d.slug));
  for (const d of [...ranked, ...others]) {
    const named = all.filter((a) => a.category === d.slug && a.cameras.includes(slug));
    // Flashes and triggers work by system: show the maker's when nothing names the model.
    const system = !named.length && (d.slug === "flashes" || d.slug === "triggers") ? all.filter((a) => a.category === d.slug && a.cameraBrands.includes(c.brand) && !a.cameras.length) : [];
    const list = named.length ? named : system;
    if (!list.length) continue;
    const [row] = accessoryRows(list, m, `cam-${m}-${slug}`, "accessories");
    out.push({ category: d.slug, label: accessoryCategory(d.slug)!.label, one: d.one, row, count: list.length, forModel: named.length > 0 });
  }
  return out;
}
