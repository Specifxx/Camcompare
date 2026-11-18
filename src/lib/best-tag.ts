// The "Best price" row treatment (owner, 2026-11-18, DECISIONS.md). When the cheapest row is a plain store that pays us nothing, it
// gets a small neutral "Best price" tag, never the green highlight; when the cheapest row is an affiliate or paid row it keeps the
// full highlight. The hint names only the rows the list really has, and says nothing about which is cheaper.
export const BEST_PRICE_TAG = "Best price";

/** A row of the price list, as far as the hint cares: eBay and (TCG sites only) TCGplayer are named by their `brand`. */
export interface HintRow {
  brand?: string | null;
}

/** "Prices and stock change: also check eBay", naming only the eBay / TCGplayer rows the list has; null when it has neither. */
export function bestPriceHint(rows: HintRow[]): string | null {
  const names = [rows.some((r) => r.brand === "ebay") && "eBay", rows.some((r) => r.brand === "tcgplayer") && "TCGplayer"].filter(Boolean) as string[];
  return names.length ? `Prices and stock change: also check ${names.join(" and ")}` : null;
}

/** The cheapest row is plain (no highlight, the small tag) exactly when it earns us nothing. */
export const isPlainBest = (row: { paid: boolean }): boolean => !row.paid;
