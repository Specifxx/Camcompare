// Price history from before we started recording it: archived copies of our
// own retailers' public pages, read through the Internet Archive's Wayback
// Machine (CDX API) and Common Crawl's public index, never from the stores
// themselves (scripts/backfill-history.ts; DECISIONS.md "Price history
// backfill from archived store pages").
//
// An archived snapshot is read exactly as the live sources read the store
// today: a Shopify products.json / product .json / .js through matchListing,
// shopifyCondition and plausiblePrice (sources/shopify.ts), a product page
// through pageListings (sources/structured.ts). Kits, other currencies and
// implausible prices are refused the same way, so an archived point means
// what a live one means: that store's lowest advertised price that day.
//
// Stored separately from the live history, committed, one file per product:
//   data/price-history-archive/<market>/<slug>.json
// and always labelled as archived wherever it is shown.
// Pure functions only (no fetches): tests/history-backfill.test.ts.
import { matchListing, plausiblePrice, type CatalogIndex } from "./matching";
import type { Currency } from "./markets";
import type { ArchivePoint } from "./price-history-archive";
import type { Condition, Retailer } from "./retailers";
import { pageListings } from "./sources/structured";
import { shopifyCondition, storeCondition } from "./sources/shopify";
import { toMinor } from "./sources/types";

export { ARCHIVE_DIR, archiveFile, readArchiveFile, writeArchiveFile, type ArchiveFile, type ArchivePoint } from "./price-history-archive";

/** One listing as an archived page showed it. `inStock` null: the page didn't say. */
export type ArchivedListing = { title: string; mpn?: string | null; gtin?: string | null; price: number; currency: Currency | string; inStock: boolean | null; condition: Condition };

type ShopifyVariant = { title?: string; price?: string | number; available?: boolean; sku?: string | null };
type ShopifyProduct = { title?: string; product_type?: string; type?: string; tags?: string[] | string; variants?: ShopifyVariant[] };

/**
 * Listings in an archived Shopify JSON body: /products.json ({products}),
 * /products/<handle>.json ({product}) or /products/<handle>.js (the product
 * itself, prices in cents as numbers). products.json names no currency: the
 * store's own (`currency`) is the market's, as the live source requires.
 */
export function listingsFromShopify(body: unknown, currency: Currency, r: Pick<Retailer, "conditions" | "shopify">, js = false): ArchivedListing[] {
  if (!body || typeof body !== "object") return [];
  const o = body as { products?: ShopifyProduct[]; product?: ShopifyProduct } & ShopifyProduct;
  const products = Array.isArray(o.products) ? o.products : o.product ? [o.product] : Array.isArray(o.variants) ? [o] : [];
  const out: ArchivedListing[] = [];
  for (const p of products) {
    if (!p?.title || !Array.isArray(p.variants)) continue;
    for (const v of p.variants) {
      if (v?.price === undefined || v.price === null) continue;
      const price = typeof v.price === "number" ? (js ? Math.round(v.price) : Math.round(v.price * 100)) : toMinor(v.price);
      if (!price) continue;
      const title = v.title && v.title !== "Default Title" ? `${p.title} ${v.title}` : p.title;
      const brand = r.shopify?.brand;
      const named = brand && !title.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${title}` : title;
      const cond = storeCondition(shopifyCondition({ title: p.title, product_type: p.product_type ?? p.type, tags: p.tags }, v.title ?? ""), r.conditions);
      out.push({ title: named, mpn: v.sku ?? null, price, currency, inStock: typeof v.available === "boolean" ? v.available : null, condition: cond });
    }
  }
  return out;
}

/**
 * HTML entities left in a JSON-LD name, hex ones included: Ted's pages say
 * "Sony&#x20;A7&#x20;Mark&#x20;V", which pageListings' decimal-only decode
 * leaves as it is and the matcher can't read.
 */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/**
 * A product page's price when its JSON-LD has none, as older store themes
 * marked it up, in order:
 *  - schema.org microdata: itemprop="price" content="995.0" with
 *    itemprop="priceCurrency" (Camera Electronic's Shopify theme, 2024);
 *  - Shopify's og:price:amount / og:price:currency;
 *  - Magento's final-price box, `data-price-amount="1299"
 *    data-price-type="finalPrice"` in the main product block, when its
 *    product:price:amount is empty (Digidirect, 2023–24).
 * One listing, titled from og:title (or the microdata name); the currency
 * must be on the page, never assumed.
 */
export function fallbackListing(html: string): ReturnType<typeof pageListings> {
  const meta = (p: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*content=["']([^"']*)`, "i"))?.[1];
  const prop = (p: string) => html.match(new RegExp(`itemprop=["']${p}["'][^>]*content=["']([^"']*)`, "i"))?.[1] ?? html.match(new RegExp(`content=["']([^"']*)["'][^>]*itemprop=["']${p}["']`, "i"))?.[1];
  const main = html.indexOf("product-info-main");
  const magento = (main >= 0 ? html.slice(main) : html).match(/data-price-amount="([\d.]+)"\s+data-price-type="finalPrice"/)?.[1];
  const title = meta("og:title") ?? prop("name") ?? html.match(/<h1[^>]*class="page-title"[^>]*>\s*<span[^>]*>([^<]+)</)?.[1];
  const candidates: [string | undefined, string | undefined][] = [
    [prop("price"), prop("priceCurrency")],
    [meta("og:price:amount"), meta("og:price:currency")],
    [magento, meta("product:price:currency")],
  ];
  const hit = candidates.find(([a, c]) => a && Number(a.replace(/,/g, "")) > 0 && c);
  if (!hit || !title) return [];
  const avail = html.match(/itemprop=["']availability["'][^>]*(?:href|content)=["']([^"']+)/i)?.[1] ?? "";
  const inStock = /outofstock|soldout|discontinued/i.test(avail) || /class="stock unavailable"/i.test(html) ? false : true;
  return [{ title: title.trim(), price: Math.round(Number(hit[0]!.replace(/,/g, "")) * 100), currency: hit[1]!.toUpperCase(), inStock, condition: null }];
}

/** Listings in an archived product page's schema.org data (JSON-LD, else OpenGraph). */
export function listingsFromHtml(html: string, pageUrl: string, r: Pick<Retailer, "conditions">): ArchivedListing[] {
  let slug = "";
  try {
    slug = decodeURIComponent(new URL(pageUrl).pathname).replace(/[-_/.]+/g, " ");
  } catch {}
  const found = pageListings(html);
  const listings = found.length ? found : fallbackListing(html);
  return listings.map((l) => {
    const title = decodeEntities(l.title);
    const fromTitle = shopifyCondition({ title: `${title} ${slug}` }, "");
    const cond = storeCondition(fromTitle !== "new" ? fromTitle : (l.condition ?? "new"), r.conditions);
    return { title, mpn: l.mpn ?? l.sku ?? null, gtin: l.gtin ?? null, price: l.price, currency: l.currency, inStock: l.inStock, condition: cond };
  });
}

/**
 * One snapshot's lowest new and used price per catalog product, through the
 * live matching. Refused: kits, another currency, out of stock (when the page
 * says so), conditions the store doesn't sell, implausible prices.
 */
export function snapshotPrices(listings: ArchivedListing[], index: CatalogIndex, currency: Currency, r: Pick<Retailer, "conditions">): Map<string, { new?: number; used?: number }> {
  const out = new Map<string, { new?: number; used?: number }>();
  for (const raw of listings) {
    if (raw.currency !== currency || raw.inStock === false) continue;
    const title = decodeEntities(raw.title);
    const condition = raw.condition === "new" ? storeCondition(shopifyCondition({ title }, ""), r.conditions) : raw.condition;
    const m = matchListing({ title, mpn: raw.mpn, gtin: raw.gtin }, index);
    if (!m.product || m.kit) continue;
    if (!r.conditions.includes(condition) || !plausiblePrice(m.product, condition, raw.price / 100, currency, m.via)) continue;
    const k = condition === "new" ? "new" : "used";
    const e = out.get(m.product.slug) ?? out.set(m.product.slug, {}).get(m.product.slug)!;
    if (e[k] === undefined || raw.price < e[k]!) e[k] = raw.price;
  }
  return out;
}

/** "20240317120000" → "2024-03-17". */
export const tsDay = (ts: string) => `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
/** A Wayback snapshot anyone can open, and its raw (unmodified) body for reading. */
export const waybackUrl = (ts: string, original: string) => `https://web.archive.org/web/${ts}/${original}`;
export const waybackRawUrl = (ts: string, original: string) => `https://web.archive.org/web/${ts}id_/${original}`;

export type CdxRow = { ts: string; original: string; mime: string; status: string; digest: string };

/** Wayback CDX `output=json` rows (first row the field names). */
export function parseCdx(rows: unknown): CdxRow[] {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const head = (rows[0] as string[]).map(String);
  const at = (k: string) => head.indexOf(k);
  return (rows.slice(1) as string[][]).map((r) => ({ ts: r[at("timestamp")], original: r[at("original")], mime: r[at("mimetype")] ?? "", status: r[at("statuscode")] ?? "", digest: r[at("digest")] ?? "" })).filter((r) => r.ts && r.original);
}

/**
 * The SURT key prefix Common Crawl's index sorts by: "www.teds.com.au", "/x"
 * → "au,com,teds)/x" (a leading www. is dropped, as the index does).
 */
export function surtPrefix(host: string, pathPrefix = "/"): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".").reverse();
  return `${parts.join(",")})${pathPrefix.toLowerCase()}`;
}

/** What kind of archived body a URL is, or null when it's none we read. */
export function snapshotKind(url: string): "products-json" | "product-json" | "product-js" | "page" | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const p = u.pathname.replace(/\/+$/, "");
  if (/\/products\.json$/i.test(p)) return "products-json";
  if (/\/products\/[^/]+\.json$/i.test(p)) return "product-json";
  if (/\/products\/[^/]+\.js$/i.test(p)) return "product-js";
  if (/\.(css|js|json|xml|txt|png|jpe?g|gif|webp|svg|ico|pdf|woff2?)$/i.test(p)) return null;
  return "page";
}

/** Two points of the same day and store become one: the lower price of each. */
export function mergePoints(existing: ArchivePoint[], incoming: ArchivePoint[]): ArchivePoint[] {
  const by = new Map<string, ArchivePoint>();
  for (const p of [...existing, ...incoming]) {
    const k = `${p.day}|${p.store}`;
    const e = by.get(k);
    if (!e) {
      by.set(k, { ...p });
      continue;
    }
    if (p.new !== undefined && (e.new === undefined || p.new < e.new)) e.new = p.new;
    if (p.used !== undefined && (e.used === undefined || p.used < e.used)) e.used = p.used;
  }
  return [...by.values()].filter((p) => p.new !== undefined || p.used !== undefined).sort((a, b) => a.day.localeCompare(b.day) || a.store.localeCompare(b.store));
}
