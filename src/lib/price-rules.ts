// One set of rules for every "lowest", "cheapest", "best price" and "from"
// claim a product page, card, quick view, world panel, metadata or JSON-LD
// makes (friends' feedback, 2026-10-22: the R50's Australian page listed
// used and kit prices while "Price around the world" said "Not priced in
// Australia yet"). DECISIONS.md, "Product pages like a shopping panel".
//
//  - The headline price is the cheapest IN-STOCK, BODY-ONLY offer of its
//    condition group (`lowest`): new, or used (used, open box, refurbished).
//    Amazon counts only where its price is shown live with its time.
//  - A kit (body plus lens, or a bundle) is never the body price. When a
//    market has no body-only price at all, the cheapest in-stock kit is shown
//    instead, always labelled as a kit with its lens ("Kit with 18-45mm").
//  - A market with any offer is never "not priced": it is "kits only",
//    "used only" or "out of stock everywhere".
// Server-only (reads the catalog).
import { lens as getLens } from "./catalog";
import { price } from "./format";
import type { Currency } from "./markets";
import { isAmazonOffer, lowest, type HistoryPoint, type Offer } from "./offers";
import { retailer } from "./retailers";

export type Group = "new" | "used";
export const groupOf = (o: Pick<Offer, "condition">): Group => (o.condition === "new" ? "new" : "used");

/** The cheapest in-stock kit of a condition group (or of any, without `group`), Amazon only with `withAmazon`. */
export function lowestKit(offers: Offer[], group?: Group, withAmazon = false): Offer | null {
  const ok = offers.filter((o) => o.kit && o.inStock && (withAmazon || !isAmazonOffer(o)) && (!group || groupOf(o) === group));
  return ok.reduce<Offer | null>((best, o) => (!best || o.price < best.price ? o : best), null);
}

export type Headline = {
  new: Offer | null; // cheapest in-stock body-only new
  used: Offer | null; // cheapest in-stock body-only used / open box / refurbished
  /** Only when there is no body-only price in either group: the cheapest in-stock new kit, else used kit. */
  kit: Offer | null;
  /** Any offer at all, in stock or not: a market with one is never "not priced". */
  listed: boolean;
};

export function headline(offers: Offer[], withAmazon = false): Headline {
  const n = lowest(offers, "new", withAmazon);
  const u = lowest(offers, "used", withAmazon);
  const kit = n || u ? null : lowestKit(offers, "new", withAmazon) ?? lowestKit(offers, "used", withAmazon);
  return { new: n, used: u, kit, listed: offers.some((o) => withAmazon || !isAmazonOffer(o)) };
}

/** The one offer a page leads with: new, else used, else a kit (labelled). */
export function leadOffer(h: Headline): { offer: Offer; what: "new" | "used" | "kit" } | null {
  if (h.new) return { offer: h.new, what: "new" };
  if (h.used) return { offer: h.used, what: "used" };
  if (h.kit) return { offer: h.kit, what: "kit" };
  return null;
}

// ------------------------------------------------------------ kit labels

// "RF-S18-45mm", "18-45mm", "XF 16-50mm", "NIKKOR Z DX 16-50mm", "FE 28-60mm"
const PREFIXES = ["RF-S", "RF", "EF-S", "EF-M", "EF", "XF", "XC", "FE", "DX", "Z DX", "NIKKOR Z", "M.Zuiko", "Lumix G", "G Vario"];
const canonPrefix = (p: string) => PREFIXES.find((x) => x.toLowerCase() === p.toLowerCase()) ?? p;
const FOCAL_RE = /(?:\b(RF-S|RF|EF-S|EF-M|EF|XF|XC|FE|DX|Z DX|NIKKOR Z|M\.Zuiko|Lumix G|G Vario)\s?)?(?<![\d.,])(\d{1,3}(?:\s?-\s?\d{1,3})?)\s?mm\b/gi;

/** The lenses a kit listing's title names, e.g. ["RF-S 18-45mm", "55-210mm"]. Never more than three. */
export function lensesInTitle(title: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of title.matchAll(FOCAL_RE)) {
    const focal = m[2].replace(/\s/g, "");
    if (seen.has(focal)) continue;
    seen.add(focal);
    out.push(m[1] ? `${canonPrefix(m[1])} ${focal}mm` : `${focal}mm`);
    if (out.length === 3) break;
  }
  return out;
}

/**
 * What a kit comes with: the listing's own lens name (`kitLensName`), else the
 * catalog name of its matched lens (`kitLens`), else the focal lengths its
 * title names. Null when none is known (it is still labelled a kit).
 */
export function kitLensLabel(o: Pick<Offer, "kit" | "title"> & Partial<Pick<Offer, "kitLensName" | "kitLens">>, pack: "body" | "fixed" | "lens" = "body"): string | null {
  if (!o.kit) return null;
  if (o.kitLensName) return o.kitLensName;
  if (o.kitLens) {
    const l = getLens(o.kitLens);
    if (l) return l.shortName;
  }
  if (pack !== "body") return null; // a fixed-lens camera's or a lens's "kit" is a bundle; its focal lengths are its own
  const ls = lensesInTitle(o.title);
  return ls.length ? ls.join(" + ") : null;
}

/** "Kit with RF-S 18-45mm", or "Kit (lens not named)" for a body; "Bundle" otherwise. */
export function kitText(o: Offer, pack: "body" | "fixed" | "lens" = "body"): string {
  const l = kitLensLabel(o, pack);
  if (pack !== "body") return l ? `Bundle with ${l}` : "Bundle";
  return l ? `Kit with ${l}` : "Kit with a lens";
}

// ------------------------------------------------------------ typical range

const quantile = (sorted: number[], q: number) => {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

export type TypicalRange = { low: number; high: number; points: number };

/**
 * "Typically X–Y" for a new body: the middle 60% (20th to 80th percentile) of
 * today's in-stock body-only new prices, one per store (eBay's single sellers
 * and Amazon left out), pooled with the last `days` days' lowest new prices
 * from our own history. Needs at least four numbers; rounded to whole units.
 * Says nothing rather than guess.
 */
export function typicalRange(offers: Offer[], history: HistoryPoint[], days = 90, today?: string | null): TypicalRange | null {
  const byStore = new Map<string, number>();
  for (const o of offers) {
    if (o.kit || !o.inStock || o.condition !== "new" || isAmazonOffer(o) || retailer(o.retailer)?.ebay) continue;
    const had = byStore.get(o.retailer);
    if (had === undefined || o.price < had) byStore.set(o.retailer, o.price);
  }
  const last = history.length ? history[history.length - 1].day : null;
  const end = Date.parse(today ?? last ?? "1970-01-01");
  const hist = history.filter((p) => p.new !== undefined && end - Date.parse(p.day) <= days * 86400_000).map((p) => p.new!);
  const pool = [...byStore.values(), ...hist].sort((a, b) => a - b);
  if (pool.length < 4) return null;
  const round = (v: number) => Math.round(v / 100) * 100;
  const low = round(quantile(pool, 0.2));
  const high = round(quantile(pool, 0.8));
  return { low, high: Math.max(low, high), points: pool.length };
}

// ------------------------------------------------------------ was-price

/** "N% off" from the store's own struck-through price: only when it is above today's price, rounded down. */
export function percentOff(priceMinor: number, wasMinor: number | null | undefined): number | null {
  if (!wasMinor || wasMinor <= priceMinor) return null;
  const pct = Math.floor(((wasMinor - priceMinor) / wasMinor) * 100);
  return pct >= 1 && pct < 90 ? pct : null;
}

// ------------------------------------------------------------ metadata

/** The price sentence of a page's meta description: body-only new and used, else the cheapest kit, labelled. Never Amazon's. */
export function priceSentence(offers: Offer[], currency: Currency, pack: "body" | "fixed" | "lens" = "body"): string {
  const h = headline(offers);
  if (h.new) return ` New from ${price(h.new.price, currency)}${h.used ? `, used from ${price(h.used.price, currency)}` : ""}.`;
  if (h.used) return ` Used from ${price(h.used.price, currency)}.`;
  if (h.kit) return ` ${pack === "body" ? "Kits with a lens" : "Bundles"} from ${price(h.kit.price, currency)}.`;
  return "";
}
