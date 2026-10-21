// Shopify stores publish their catalogue at /products.json (and per
// collection at /collections/<handle>/products.json). RiftCompare prices
// 200+ card shops this way (src/lib/price-import.ts there); CamCompare uses
// it only for camera shops that run Shopify, never past a robots.txt
// Disallow, at one request every ~half second, with a contact header.
// `country=` asks Shopify Markets for the market's own price, and the
// store's currency (/meta.json) must be the market's.
import { accessoryOffer, classifyAccessory, type AccessoryOffer } from "../accessories";
import type { Lens } from "../catalog/schema";
import { kitLensOf, matchListing, plausiblePrice, type CatalogIndex } from "../matching";
import { MARKETS, type Currency } from "../markets";
import type { Offer } from "../offers";
import type { Condition, Retailer } from "../retailers";
import { availableNow, detailOf, promoOf, shopifyAvailability, wasPriceOf } from "./detail";
import { sleep, toMinor, type PriceSource, type SourceContext, type SourceResult } from "./types";

const UA = "Mozilla/5.0 (compatible; CamCompareBot/0.1; +https://github.com/Specifxx/Camcompare)";
const FROM = "camcompare-bot@users.noreply.github.com";
const MAX_PAGES = 60;
const RETRIES = 4;

/**
 * GET with backoff on 429 and 5xx (2, 4, 8, 16 s, or the store's Retry-After
 * up to a minute): Shopify answers bursts from shared CI addresses with 503s.
 * Anything else, and the last retry's answer, comes back as it is.
 */
export async function politeGet(url: string, headers: Record<string, string>, wait: (ms: number) => Promise<unknown> = sleep): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers });
    if (attempt >= RETRIES || !(res.status === 429 || res.status >= 500)) return res;
    const after = Number(res.headers.get("retry-after"));
    await wait(Number.isFinite(after) && after > 0 ? Math.min(after, 60) * 1000 : 2000 * 2 ** attempt);
  }
}

type Variant = { id: number; title: string; price: string; available: boolean; sku?: string | null; compare_at_price?: string | null; inventory_quantity?: number | null };
export type ShopifyProduct = { id: number; title: string; handle: string; vendor?: string; product_type?: string; tags?: string[] | string; body_html?: string | null; variants: Variant[] };

/**
 * Is `path` allowed for us by this robots.txt? RFC 9309 matching: `*` is any
 * run of characters, a final `$` anchors the end, and the longest matching
 * rule wins (Allow on a tie). Rules for "*" and for CamCompareBot both count.
 * Cutting each rule at its first `*` turned Shopify's default robots.txt
 * (rules that start `/*` or `*`) into a Disallow of every path.
 */
export function robotsAllows(robots: string, path: string): boolean {
  let applies = false;
  let group = false; // consecutive User-agent lines share one group
  let best = { length: -1, allow: true };
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^(user-agent|disallow|allow)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [, field, value] = m;
    if (/^user-agent$/i.test(field)) {
      const ours = value === "*" || /camcompare/i.test(value);
      applies = group ? applies || ours : ours;
      group = true;
      continue;
    }
    group = false;
    if (!applies || !value || !robotsRule(value).test(path)) continue;
    const allow = /^allow$/i.test(field);
    if (value.length > best.length || (value.length === best.length && allow)) best = { length: value.length, allow };
  }
  return best.allow;
}

function robotsRule(rule: string): RegExp {
  const end = rule.endsWith("$");
  const body = (end ? rule.slice(0, -1) : rule).split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${body}${end ? "$" : ""}`);
}

export function shopifyCondition(p: Pick<ShopifyProduct, "title" | "product_type" | "tags">, variantTitle: string): Condition {
  const text = `${p.title} ${variantTitle} ${p.product_type ?? ""} ${Array.isArray(p.tags) ? p.tags.join(" ") : p.tags ?? ""}`.toLowerCase();
  if (/\brefurb/.test(text)) return "refurbished";
  // Before "used": an "Open Box" listing is often also tagged used.
  if (/\b(ex-?demo|demo unit|open box|open-box|display unit)\b/.test(text)) return "open-box";
  if (/\b(used|pre-?owned|second-?hand|preloved|trade-?in)\b/.test(text)) return "used";
  return "new";
}

/**
 * A listing's condition at this store. Second-hand shops (Cash Converters
 * SG) don't tag their stock as used, so at a store that sells no new gear an
 * untagged listing is the store's own condition, not "new".
 */
export function storeCondition(cond: Condition, conditions: readonly Condition[]): Condition {
  return cond === "new" && !conditions.includes("new") ? conditions[0] ?? cond : cond;
}

/** What one Shopify product's variants come to: catalog offers and accessory listings. */
export function productOffers(p: ShopifyProduct, ctx: { base: string; retailer: Retailer; index: CatalogIndex; lenses: Lens[]; now: string; currency: Currency }): { offers: Offer[]; accessories: AccessoryOffer[]; variants: number } {
  const { base, retailer: r, index, lenses, now, currency } = ctx;
  const brand = r.shopify?.brand;
  const offers: Offer[] = [];
  const accessories: AccessoryOffer[] = [];
  const promo = promoOf({ title: p.title, tags: p.tags, body: p.body_html });
  for (const v of p.variants) {
    const title = v.title && v.title !== "Default Title" ? `${p.title} ${v.title}` : p.title;
    const named = brand && !title.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${title}` : title;
    const m = matchListing({ title: named, mpn: v.sku }, index);
    const price = toMinor(v.price);
    const availability = shopifyAvailability({ available: v.available, title, tags: p.tags, productType: p.product_type, body: p.body_html, inventoryQuantity: v.inventory_quantity });
    const inStock = availableNow(availability, v.available);
    const wasPrice = wasPriceOf(price, v.compare_at_price ? toMinor(v.compare_at_price) : null);
    const cond = storeCondition(shopifyCondition(p, v.title), r.conditions);
    const url = `${base}/products/${p.handle}?variant=${v.id}`;
    if (!m.product) {
      // Not a camera or lens: maybe an accessory (src/lib/accessories.ts).
      const a = accessoryOffer({ title, productType: p.product_type, vendor: p.vendor, price, currency, url, inStock, condition: cond, sourceId: String(v.id) }, index, r.key, now);
      if (a) accessories.push(a);
      continue;
    }
    if (!price || !plausiblePrice(m.product, cond, price / 100, currency, m.via)) continue;
    const kit = m.kit && m.kind === "camera" ? kitLensOf(named, index, lenses, m.product) : null;
    offers.push({
      product: m.product.slug,
      kind: m.kind,
      retailer: r.key,
      condition: cond,
      price,
      currency,
      url,
      title,
      seller: null,
      inStock,
      kit: m.kit,
      mount: m.mount,
      seenAt: now,
      sourceId: String(v.id),
      wasPrice,
      availability,
      kitLens: kit?.kitLens ?? null,
      kitLensName: kit?.kitLensName ?? null,
      promo,
      detail: detailOf({ variant: v.title, title, text: cond === "new" ? null : p.body_html, used: cond !== "new" }),
    });
  }
  return { offers, accessories, variants: p.variants.length };
}

/** A /products/<handle>.js body (cents, `type`, `description`) as products.json's shape. */
export function fromProductJs(j: { id: number; title: string; handle: string; vendor?: string; type?: string; tags?: string[]; description?: string; variants: { id: number; title: string; price: number; available: boolean; sku?: string | null; compare_at_price?: number | null }[] }): ShopifyProduct {
  const money = (n: number | null | undefined) => (typeof n === "number" ? (n / 100).toFixed(2) : null);
  return {
    id: j.id,
    title: j.title,
    handle: j.handle,
    vendor: j.vendor,
    product_type: j.type,
    tags: j.tags,
    body_html: j.description ?? null,
    variants: j.variants.map((v) => ({ id: v.id, title: v.title, price: money(v.price) ?? "0", available: v.available, sku: v.sku, compare_at_price: money(v.compare_at_price) })),
  };
}

export const shopifySource = (retailerKey: string): PriceSource => ({
  retailer: retailerKey,
  async run(ctx) {
    const { market, retailer: r, index, lenses, now, log } = ctx;
    if (!r.shopify) return { status: "skipped", note: "no Shopify config" };
    if (r.shopify.disabled) return { status: "skipped", note: r.shopify.disabled };
    const base = r.shopify.base.replace(/\/$/, "");
    // RFC 9309: a missing robots.txt allows everything; one the server can't
    // serve (5xx) disallows everything until it can.
    const robotsRes = await politeGet(`${base}/robots.txt`, { "User-Agent": UA });
    if (robotsRes.status >= 500) throw new Error(`robots.txt ${robotsRes.status}`);
    if (robotsRes.status === 403 || robotsRes.status === 429) return { status: "error", note: `robots.txt ${robotsRes.status}: not crawling` };
    const robots = robotsRes.ok ? await robotsRes.text() : "";
    // products.json names no currency, so the store's own (/meta.json) must be
    // the market's: another currency is refused, never converted.
    const currency = MARKETS[market].currency;
    if (!robotsAllows(robots, "/meta.json")) return { status: "skipped", note: "robots.txt disallows /meta.json: store currency unknown" };
    const meta = await politeGet(`${base}/meta.json`, { "User-Agent": UA }).then((x) => (x.ok ? (x.json() as Promise<{ currency?: string }>) : null)).catch(() => null);
    const storeCurrency = meta?.currency ?? r.shopify.currency;
    if (!storeCurrency) throw new Error("no store currency in /meta.json");
    if (storeCurrency !== currency) return { status: "skipped", note: `store charges in ${storeCurrency}, not ${currency}` };
    if (r.shopify.sitemap) return sitemapRun(ctx, base, robots, currency);
    const paths = (r.shopify.collections?.length ? r.shopify.collections.map((c) => `/collections/${c}/products.json`) : ["/products.json"]).filter((p) => robotsAllows(robots, `${p}?limit=250&page=1&country=${r.country}`));
    if (!paths.length) return { status: "skipped", note: "robots.txt disallows products.json" };
    const offers: Offer[] = [];
    const accessories: AccessoryOffer[] = [];
    let seen = 0;
    for (const path of paths) {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await politeGet(`${base}${path}?limit=250&page=${page}&country=${r.country}`, { "User-Agent": UA, From: FROM });
        if (res.status === 429 || res.status === 403) throw new Error(`${res.status} on ${path} page ${page}`);
        if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) throw new Error(`${res.status} non-JSON on ${path}`);
        const products = ((await res.json()) as { products?: ShopifyProduct[] }).products ?? [];
        if (!products.length) break;
        for (const p of products) {
          const got = productOffers(p, { base, retailer: r, index, lenses, now, currency });
          seen += got.variants;
          offers.push(...got.offers);
          accessories.push(...got.accessories);
        }
        await sleep(500);
      }
    }
    log(`${r.key}: ${seen} variants, ${offers.length} matched, ${accessories.length} accessories`);
    return { status: "ok", offers, note: `${seen} variants`, accessories };
  },
});

/**
 * Stores whose robots.txt keeps the paged catalogue out (Ted's: `Disallow:
 * /*?limit=`) or whose catalogue is mostly not cameras (JB Hi-Fi: ~100k
 * products, DVDs and TVs) but allows their sitemaps and product pages: the
 * product sitemaps give every handle; a handle the matcher reads as a catalog
 * product (or the classifier as an accessory) is fetched as
 * /products/<handle>.js, one at a time with a delay, within a per-run budget
 * that rotates, so every product is re-read within a day. Products not read
 * this run keep their earlier offers (`covered`). A 403/429 stops the run.
 */
async function sitemapRun(ctx: SourceContext, base: string, robots: string, currency: Currency): Promise<SourceResult> {
  const { retailer: r, index, lenses, now, log } = ctx;
  const cfg = r.shopify!.sitemap!;
  const delay = Math.max(cfg.delayMs ?? 1000, crawlDelay(robots));
  const headers = { "User-Agent": UA, From: FROM };
  if (!robotsAllows(robots, "/sitemap.xml")) return { status: "skipped", note: "robots.txt disallows /sitemap.xml" };
  const idx = await politeGet(`${base}/sitemap.xml`, headers);
  if (idx.status === 403 || idx.status === 429) return { status: "error", note: `sitemap ${idx.status}: not crawling` };
  if (!idx.ok) throw new Error(`sitemap.xml ${idx.status}`);
  let children = locs(await idx.text()).filter((u) => /sitemap_products_\d+\.xml/.test(u));
  const slot = Math.floor(Date.parse(now) / (3 * 3600_000));
  if (cfg.window && children.length > cfg.window) {
    const start = (slot * cfg.window) % children.length;
    children = [...children.slice(start), ...children.slice(0, start)].slice(0, cfg.window);
  }
  const handles = new Set<string>();
  for (const u of children) {
    await sleep(delay);
    const res = await politeGet(u, headers);
    if (res.status === 403 || res.status === 429) return { status: "error", note: `product sitemap ${res.status}: stopped` };
    if (!res.ok) continue;
    for (const loc of locs(await res.text())) {
      const m = loc.match(/\/products\/([^/?#]+)$/);
      if (m) handles.add(decodeURIComponent(m[1]));
    }
  }
  // Candidates: handles that read as a catalog product, then (with what the
  // budget leaves) as an accessory.
  const byProduct = new Map<string, string[]>();
  const spare: string[] = [];
  for (const h of handles) {
    if (!robotsAllows(robots, `/products/${h}.js`)) continue;
    const words = h.replace(/[-_]+/g, " ");
    const slug = matchListing({ title: r.shopify!.brand && !words.includes(r.shopify!.brand.toLowerCase()) ? `${r.shopify!.brand} ${words}` : words }, index).product?.slug;
    if (slug) (byProduct.get(slug) ?? byProduct.set(slug, []).get(slug)!).push(h);
    else if (classifyAccessory({ title: words })) spare.push(h);
  }
  const budget = cfg.budget ?? 300;
  const all = [...byProduct.keys()].sort();
  const queue: [string | null, string][] = all.flatMap((p) => byProduct.get(p)!.sort().slice(0, 8).map((h) => [p, h] as [string, string]));
  const start = queue.length > budget ? (slot * budget) % queue.length : 0;
  const window = [...queue.slice(start), ...queue.slice(0, start)].slice(0, budget);
  spare.sort();
  const room = Math.min(cfg.accessories ?? 60, budget - window.length);
  const sStart = spare.length > room && room > 0 ? (slot * room) % spare.length : 0;
  const extra: [null, string][] = room > 0 ? [...spare.slice(sStart), ...spare.slice(0, sStart)].slice(0, room).map((h) => [null, h]) : [];
  const offers: Offer[] = [];
  const accessories: AccessoryOffer[] = [];
  const covered = new Set<string>();
  let read = 0;
  let stop = "";
  for (const [slug, h] of [...window, ...extra]) {
    await sleep(delay);
    const res = await politeGet(`${base}/products/${encodeURIComponent(h)}.js`, headers);
    if (res.status === 403 || res.status === 429) {
      stop = `stopped after ${read} products: ${res.status}`;
      break;
    }
    if (slug) covered.add(slug); // read, even if gone (404): its old offers should go
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) continue;
    read++;
    const got = productOffers(fromProductJs(await res.json()), { base, retailer: r, index, lenses, now, currency });
    for (const o of got.offers) covered.add(o.product);
    offers.push(...got.offers);
    accessories.push(...got.accessories);
  }
  const note = `${handles.size} handles in ${children.length} sitemaps, ${queue.length} candidates, ${read} products read${stop ? `; ${stop}` : ""}`;
  log(`${r.key}: ${note}, ${offers.length} offers, ${accessories.length} accessories`);
  if (!read && window.length) return { status: "error", note };
  return { status: "ok", offers, covered: [...covered], note, accessories };
}

const locs = (xml: string) => [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?\s*<\/loc>/g)].map((m) => m[1].trim().replace(/&amp;/g, "&"));
const crawlDelay = (robots: string) => {
  const m = robots.match(/^\s*crawl-delay\s*:\s*([\d.]+)/im);
  return m ? Math.min(Number(m[1]) * 1000, 10000) : 0;
};
