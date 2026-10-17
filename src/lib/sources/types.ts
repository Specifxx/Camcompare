import type { Camera } from "../catalog/schema";
import type { CatalogIndex } from "../matching";
import type { Offer } from "../offers";

export type SourceContext = { cameras: Camera[]; index: CatalogIndex; now: string; log: (msg: string) => void };

export type SourceResult =
  | { status: "ok"; offers: Offer[]; note?: string }
  | { status: "skipped"; note: string } // not configured: keep nothing, report it
  | { status: "error"; note: string }; // configured but failed: the import keeps yesterday's offers

export type PriceSource = { retailer: string; run: (ctx: SourceContext) => Promise<SourceResult> };

export const toCents = (v: string | number) => Math.round(Number(String(v).replace(/[^0-9.]/g, "")) * 100);
