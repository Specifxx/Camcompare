import type { AccessoryOffer } from "../accessories";
import type { Camera, Lens } from "../catalog/schema";
import type { MarketCode } from "../markets";
import type { CatalogIndex } from "../matching";
import type { Offer, OffersFile } from "../offers";
import type { Retailer } from "../retailers";

export type SourceContext = {
  market: MarketCode;
  retailer: Retailer;
  cameras: Camera[];
  lenses: Lens[];
  index: CatalogIndex;
  now: string;
  prev: OffersFile; // this market's offers from the last run
  log: (msg: string) => void;
};

export type SourceResult =
  // `covered`: products this run actually checked. When set, the import keeps
  // the retailer's earlier offers for every OTHER product (sources that rotate
  // through the catalog under a daily quota, like eBay).
  // `accessories`: listings that are no camera or lens but a camera
  // accessory (src/lib/accessories.ts), from sources that read whole shops.
  | { status: "ok"; offers: Offer[]; note?: string; covered?: string[]; accessories?: AccessoryOffer[] }
  | { status: "skipped"; note: string } // not configured: keep nothing, report it
  | { status: "error"; note: string }; // configured but failed: the import keeps yesterday's offers

export type PriceSource = { retailer: string; run: (ctx: SourceContext) => Promise<SourceResult> };

/** "1,299.00 GBP" / "£1.299,00" / "1299" → minor units. Comma-decimal aware. */
export function toMinor(v: string | number): number {
  if (typeof v === "number") return Math.round(v * 100);
  let s = v.replace(/[^0-9.,]/g, "");
  if (/,\d{2}$/.test(s) && (s.match(/\./g)?.length ?? 0) <= 1 && !/\.\d{2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** A search phrase for a product: brand word + its first alias. */
export function searchPhrase(p: { brand: string; aliases: string[] }): string {
  const brand = { "om-system": "OM System", "7artisans": "7Artisans", samyang: "Samyang" }[p.brand] ?? p.brand;
  return `${brand} ${p.aliases[0]}`.replace(/α/g, "a");
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
