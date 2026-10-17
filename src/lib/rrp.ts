// Client-safe arithmetic for the "Above RRP" and "Above typical used price"
// row warnings (components/OfferRows.tsx, product page and quick view). We
// flag the PRICE, never name a private marketplace seller (friends'
// feedback asked to "name and shame"; DECISIONS 2026-10-17).

/** How far `priceMinor` sits above `refMinor`, in whole percent; null when not above (or no reference). */
export function overBy(priceMinor: number, refMinor: number | null | undefined): number | null {
  if (!refMinor || refMinor <= 0 || priceMinor <= refMinor) return null;
  const pct = Math.round(((priceMinor - refMinor) / refMinor) * 100);
  return pct >= 1 ? pct : null;
}

export type RowWarning = { kind: "rrp" | "used"; text: string };

/**
 * The warning for one offer row, if any. A new offer above this market's RRP
 * (launch list price); a used or refurbished one above the typical used price.
 * Kits are never flagged.
 */
export function rowWarning(row: { price: number; condition: string; kit?: boolean }, rrpMinor: number | null | undefined, usedTypicalMinor: number | null | undefined): RowWarning | null {
  // A kit (body plus lens) is not the body's price: never compared with it.
  if (row.kit) return null;
  const isNew = row.condition.toLowerCase() === "new";
  if (isNew) {
    const pct = overBy(row.price, rrpMinor);
    return pct !== null ? { kind: "rrp", text: `Above RRP +${pct}%` } : null;
  }
  // A used price above new RRP is the louder warning.
  const overRrp = overBy(row.price, rrpMinor);
  if (overRrp !== null) return { kind: "rrp", text: `Above RRP +${overRrp}%` };
  return overBy(row.price, usedTypicalMinor) !== null ? { kind: "used", text: "Above typical used price" } : null;
}
