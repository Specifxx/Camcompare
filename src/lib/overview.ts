// The "Overview" at the top of a product page: what it is, who it suits, what
// it costs in this market today, and what to weigh it against, in sentences.
// Every word comes from the catalog, today's offers and our own price history
// (lib/price-rules.ts decides each price claim, as everywhere else): nothing
// is written by hand, so a fact changes only when its data does. Search
// Console's "Crawled, not indexed" pages were product pages whose only text
// specific to them sat in tables (DECISIONS.md, "Indexing: canonicals,
// hreflang and internal links").
// Server-only (reads the catalog).
import { brandName, camerasFor, displayShortName, mount, offersFor, product, type AnyProduct } from "./catalog";
import type { Camera, Lens } from "./catalog/schema";
import { longMonthYear, price } from "./format";
import { MARKET_CODES, MARKETS, marketPath, type MarketCode } from "./markets";
import { isAmazonOffer, type HistoryPoint, type Offer } from "./offers";
import { headline, typicalRange } from "./price-rules";
import { retailer } from "./retailers";
import { sensorLabel } from "./specs/definitions";
import { apertureLabel, coverageLabel, focalLabel } from "./specs/lens";
import type { Fit } from "./things-to-know";

/** A run of text, or a link inside it. */
export type Seg = string | { text: string; href: string; nofollow?: boolean };
export type Overview = Seg[][];

// "a, b and c". When an item has its own "and" ("vlogging and selfies"):
// "a, b, and c", or "a as well as b" for two.
const list = (xs: Seg[]): Seg[] => {
  const ands = xs.some((x) => (typeof x === "string" ? x : x.text).includes(" and "));
  const last = ands ? (xs.length === 2 ? " as well as " : ", and ") : " and ";
  return xs.flatMap((x, i) => (i === 0 ? [x] : [i === xs.length - 1 ? last : ", ", x]));
};
// "an 85mm", "an 18 MP", "an 11–20mm"; "a 100mm", "a 24 MP".
const an = (s: string) => (/^(8|1[18](\D|$))/.test(s) ? "an" : "a");
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "in the United States", "in Europe". */
export const inMarket = (m: MarketCode) => (m === "us" || m === "uk" ? `in the ${MARKETS[m].name}` : `in ${MARKETS[m].name}`);

const CAMERA_NOUN: Record<Camera["type"], string> = {
  mirrorless: "mirrorless camera",
  dslr: "DSLR",
  compact: "compact camera",
  "medium-format": "medium-format camera",
  rangefinder: "rangefinder",
  action: "action camera",
  "360": "360° camera",
  cinema: "cinema camera",
};
const sensorWord = (f: Camera["specs"]["sensorFormat"]) =>
  f === "full-frame" ? "full-frame" : f === "medium-format" ? "medium-format" : sensorLabel(f).replace(/^(\d[\d./]*)"$/, "$1-inch");
const coverageWord = (c: Lens["coverage"]) => (c === "full-frame" ? "full-frame" : c === "medium-format" ? "medium-format" : coverageLabel(c));

const productHref = (p: AnyProduct, m: MarketCode) => marketPath(m, `/${p.kind === "camera" ? "cameras" : "lenses"}/${p.item.slug}`);
/** A link to another product in this market, nofollow where that market's page is noindex. */
const productLink = (p: AnyProduct, m: MarketCode): Seg => ({
  text: `${brandName(p.item.brand)} ${displayShortName(p.item, m)}`,
  href: productHref(p, m),
  ...(m === "us" || offersFor(p.item.slug, m).length ? {} : { nofollow: true }),
});

function whatItIs(self: AnyProduct, m: MarketCode, name: string): Seg[] {
  const brand: Seg = { text: brandName(self.item.brand), href: marketPath(m, `/brands/${self.item.brand}`) };
  const when = ` in ${longMonthYear(self.item.announced)}.`;
  if (self.kind === "camera") {
    const c = self.item;
    const what = `${c.specs.megapixels} MP ${sensorWord(c.specs.sensorFormat)} ${CAMERA_NOUN[c.type]}`;
    const mt = c.mount ? mount(c.mount) : null;
    const out: Seg[] = [`The ${name} is ${an(String(c.specs.megapixels))} ${what}`];
    if (mt) out.push(" for ", { text: mt.name, href: marketPath(m, `/mounts/${mt.slug}`) });
    else out.push(" with a built-in lens");
    out.push(", announced by ", brand, when);
    return out;
  }
  const l = self.item;
  const focal = focalLabel(l);
  const zoom = l.specs.focalMaxMm > l.specs.focalMinMm ? "zoom" : "prime";
  const mounts = l.mounts.map((x) => mount(x)).filter((x): x is NonNullable<typeof x> => x !== null);
  const out: Seg[] = [`The ${name} is ${an(focal)} ${focal} ${apertureLabel(l)} ${zoom} for ${coverageWord(l.coverage)} cameras on `];
  out.push(...list(mounts.map((mt) => ({ text: mt.name, href: marketPath(m, `/mounts/${mt.slug}`) }))));
  out.push(", announced by ", brand, when);
  const bodies = camerasFor(l).length;
  if (bodies) out.push(` ${bodies === 1 ? "One camera" : `${bodies} cameras`} we track take it without an adapter.`);
  return out;
}

function family(self: AnyProduct, m: MarketCode): Seg[] {
  const it = self.item;
  const succ = it.successor ? product(it.successor) : null;
  const out: Seg[] = [];
  if (succ) out.push(" It has been followed by the ", productLink(succ, m), it.status === "current" ? "; both are still sold." : ".");
  else if (it.status === "discontinued") out.push(" It is discontinued, so new stock may be limited.");
  return out;
}

function whoFor(goodFor: Fit[], notFor: Fit[]): Seg[] {
  if (!goodFor.length) return [];
  const out: Seg[] = ["Going by its spec sheet, it suits ", ...list(goodFor.slice(0, 4).map((f) => lower(f.label))), "."];
  if (notFor.length) out.push(" It is a weaker pick for ", ...list(notFor.slice(0, 3).map((f) => lower(f.label))), ".");
  return out;
}

/** Today's price in this market, the usual range from our history, the launch price; or where else it is sold. */
export function priceLine(self: AnyProduct, m: MarketCode, offers: Offer[], history: HistoryPoint[], launch: { amount: number; currency: string } | null): Seg[] {
  const cur = MARKETS[m].currency;
  const where = inMarket(m);
  const h = headline(offers);
  const out: Seg[] = [];
  if (h.new) {
    // One lowest price per store, the store's own stock only (no Amazon, no eBay sellers).
    const perStore = new Map<string, number>();
    for (const o of offers) {
      if (o.kit || !o.inStock || o.condition !== "new" || isAmazonOffer(o) || retailer(o.retailer)?.ebay) continue;
      const had = perStore.get(o.retailer);
      if (had === undefined || o.price < had) perStore.set(o.retailer, o.price);
    }
    const high = Math.max(h.new.price, ...perStore.values());
    const stores = perStore.size;
    out.push(
      high > h.new.price && stores > 1
        ? `New, it sells for ${price(h.new.price, cur)} to ${price(high, cur)} at the ${stores} stores we track ${where} that have it in stock`
        : `New, it sells for ${price(h.new.price, cur)} ${where} (${retailer(h.new.retailer)?.name ?? "one store"})`,
    );
    out.push(h.used ? `; used and refurbished copies start at ${price(h.used.price, cur)}.` : ".");
    const typ = typicalRange(offers, history);
    if (typ && typ.high > typ.low) out.push(` Over the last 90 days it has usually cost ${price(typ.low, cur)} to ${price(typ.high, cur)} new.`);
  } else if (h.used) {
    out.push(`No store we track ${where} has it new in stock today; used and refurbished copies start at ${price(h.used.price, cur)}.`);
  } else if (h.kit) {
    out.push(`${where.charAt(0).toUpperCase()}${where.slice(1)} it is on sale only ${self.kind === "camera" ? "in kits with a lens" : "in bundles"} today, from ${price(h.kit.price, cur)}.`);
  } else if (h.listed) {
    out.push(`Stores we track ${where} list it, but none has it in stock today.`);
  } else {
    out.push(`No store we track ${where} lists it today.`);
    const elsewhere = MARKET_CODES.filter((x) => x !== m && offersFor(self.item.slug, x).length > 0);
    if (elsewhere.length)
      out.push(
        " It is listed in ",
        ...list(elsewhere.map((x) => ({ text: inMarket(x).replace(/^in /, ""), href: marketPath(x, `/${self.kind === "camera" ? "cameras" : "lenses"}/${self.item.slug}`) }))),
        ".",
      );
  }
  if (launch) out.push(` It launched at ${price(launch.amount * 100, launch.currency as typeof cur)}${self.kind === "camera" && (self.item as Camera).mount ? " (body only)" : ""}.`);
  return out;
}

function alsoConsider(alts: AnyProduct[], m: MarketCode): Seg[] {
  if (!alts.length) return [];
  return ["Worth comparing it with the ", ...list(alts.slice(0, 3).map((p) => productLink(p, m))), "."];
}

export function overview(opts: {
  self: AnyProduct;
  m: MarketCode;
  name: string;
  goodFor: Fit[];
  notFor: Fit[];
  history: HistoryPoint[];
  launch: { amount: number; currency: string } | null;
  /** Rivals first, then similar products (lib/related.ts). */
  alternatives: AnyProduct[];
}): Overview {
  const { self, m } = opts;
  const offers = offersFor(self.item.slug, m);
  return [
    [...whatItIs(self, m, opts.name), ...family(self, m)],
    whoFor(opts.goodFor, opts.notFor),
    priceLine(self, m, offers, opts.history, opts.launch),
    alsoConsider(opts.alternatives, m),
  ].filter((p) => p.length);
}

/** The overview as plain text (tests, and a check that it says something). */
export const overviewText = (o: Overview) => o.map((p) => p.map((s) => (typeof s === "string" ? s : s.text)).join("")).join("\n");

