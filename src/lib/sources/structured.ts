// Structured data from a retailer's own product pages, for shops with no
// feed or API yet (owner, 2026-10-17: "we need the live prices"). The site's
// robots.txt names its sitemaps; product URLs whose slug the matcher reads as
// a catalog product are fetched politely (one at a time, a delay between
// requests, a per-run budget), and the page's schema.org JSON-LD Product /
// Offer (or OpenGraph product:price) gives price, currency, stock and
// condition. Never Amazon or eBay, never a path robots.txt disallows, never
// past bot protection: a 403/429/challenge stops the run.
import { gunzipSync } from "node:zlib";
import { accessoryOffer, classifyAccessory, type AccessoryOffer } from "../accessories";
import { kitLensOf, matchListing, plausiblePrice } from "../matching";
import { MARKETS } from "../markets";
import type { Availability, Offer } from "../offers";
import type { Condition } from "../retailers";
import { availableNow, detailOf, promoOf, schemaAvailability, wasPriceOf } from "./detail";
import { cheapestPerProduct } from "./feed";
import { robotsAllows, secondHandImage, shopifyCondition } from "./shopify";
import { sleep, toMinor, type PriceSource } from "./types";

const UA = "Mozilla/5.0 (compatible; CamCompareBot/0.1; +https://github.com/Specifxx/Camcompare)";
const MAX_SITEMAPS = 40;

export type StructuredConfig = {
  /** Product sitemap URLs; default: robots.txt Sitemap: lines. */
  sitemaps?: string[];
  /** Child sitemaps of an index worth reading (default /product/i, else all). */
  sitemapFilter?: RegExp;
  /** Product page URLs (default: all). */
  urlFilter?: RegExp;
  /**
   * The shop's product URLs don't name the product (Cash Converters:
   * ".../cameras/lenses-filters/camera-lens/001300347004"), so the slug can't
   * pick candidates: every `urlFilter` page is one, read in a rotating sample
   * within the budget, and matched on the page's own title.
   */
  slugless?: boolean;
  /**
   * Read only this many child sitemaps of an index per run, a different
   * window each run, for shops with hundreds of them (all ≈ 90 MB).
   */
  sitemapWindow?: number;
  /** Product pages per run (default 250). */
  budget?: number;
  /**
   * Where a page names the branch that holds the item (Cash Converters:
   * one site for every store): the first capture group is the branch, put
   * in the offer's `detail` so two identical listings can be told apart.
   */
  branch?: RegExp;
  delayMs?: number;
};

export function blockedReason(status: number, headers: Headers, body: string): string | null {
  if (headers.get("cf-mitigated") === "challenge") return "Cloudflare challenge";
  if (status === 401 || status === 403 || status === 429) return String(status);
  if (/<title>\s*(Just a moment|Attention Required|Access Denied|Robot or human|Pardon Our Interruption)/i.test(body) || /_cf_chl_opt|captcha-delivery\.com|px-captcha|_Incapsula_Resource/i.test(body)) return "bot challenge page";
  return null;
}

async function get(url: string): Promise<{ status: number; headers: Headers; text: string }> {
  const r = await fetch(url, { headers: { "User-Agent": UA, From: "camcompare-bot@users.noreply.github.com", Accept: "text/html,application/xml;q=0.9,*/*;q=0.8" }, signal: AbortSignal.timeout(30000) });
  const buf = Buffer.from(await r.arrayBuffer());
  const text = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
  return { status: r.status, headers: r.headers, text };
}

const locs = (xml: string) => [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?\s*<\/loc>/g)].map((m) => m[1].trim().replace(/&amp;/g, "&"));

/** A URL's path as words the matcher can read ("canon-eos-r6-mark-ii" → "canon eos r6 mark ii"). */
export function slugText(url: string): string {
  let p = new URL(url).pathname;
  try {
    p = decodeURIComponent(p);
  } catch {}
  return p.replace(/\.(html?|aspx|php)$/i, "").replace(/[-_+/.]+/g, " ").trim();
}

export type PageListing = {
  title: string;
  gtin?: string;
  mpn?: string;
  sku?: string;
  price: number;
  currency: string;
  inStock: boolean;
  condition: Condition | null;
  /** The page's own strikethrough / list price (priceSpecification), above `price`. */
  wasPrice?: number | null;
  availability?: Availability | null;
  description?: string;
  /** The Product's JSON-LD `image` (first entry). */
  image?: string;
};

/** A page's (possibly relative) URL made absolute, or null. */
function absolute(v: string | undefined, base: string): string | null {
  if (!v) return null;
  try {
    return new URL(v, base).toString();
  } catch {
    return null;
  }
}

/** JSON-LD `image`: a URL, an ImageObject, or a list of either; the first. */
function firstImage(v: unknown): string | undefined {
  const x = Array.isArray(v) ? v[0] : v;
  if (typeof x === "string") return x.trim() || undefined;
  if (x && typeof x === "object") return str((x as Record<string, unknown>).url ?? (x as Record<string, unknown>).contentUrl);
  return undefined;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : undefined);
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));

function schemaCondition(v: unknown): Condition | null | "refuse" {
  const s = str(v)?.toLowerCase() ?? "";
  if (!s) return null;
  if (s.includes("damaged")) return "refuse";
  if (s.includes("refurb")) return "refurbished";
  if (s.includes("used")) return "used";
  if (s.includes("new")) return "new";
  return null;
}
const inStockOf = (v: unknown) => /instock|limitedavailability|onlineonly|instoreonly/i.test(str(v) ?? "");

/** The optional fields, only those the page states. */
const extras = (wasPrice: number | null, availability: Availability | null, description?: string) => ({
  ...(wasPrice ? { wasPrice } : {}),
  ...(availability ? { availability } : {}),
  ...(description ? { description: decode(description) } : {}),
});

/** Every priced Product on a page: JSON-LD first, then OpenGraph product:price. Exported for tests. */
export function pageListings(html: string): PageListing[] {
  const nodes: Record<string, unknown>[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(walk);
    const o = n as Record<string, unknown>;
    nodes.push(o);
    walk(o["@graph"]);
    walk(o.hasVariant);
  };
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1].trim()));
    } catch {
      try {
        walk(JSON.parse(m[1].replace(/[\u0000-\u001f]+/g, " ")));
      } catch {}
    }
  }
  const out: PageListing[] = [];
  for (const n of nodes) {
    const t = n["@type"];
    if (!(t === "Product" || (Array.isArray(t) && t.includes("Product")))) continue;
    let name = str(n.name);
    if (!name) continue;
    name = decode(name);
    const brand = str((n.brand as Record<string, unknown>)?.name ?? n.brand);
    const title = brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name;
    // Only a real GTIN length: Camera House puts its 5-digit SKU in `gtin8`.
    const gtin = [n.gtin13, n.gtin12, n.gtin14, n.gtin, n.gtin8].map(str).find((g) => g && /^\d{8}$|^\d{12,14}$/.test(g.replace(/\D/g, "")));
    const description = str(n.description);
    const image = firstImage(n.image);
    const offers = ([] as unknown[]).concat(n.offers ?? []).flatMap((o) => {
      const r = o as Record<string, unknown>;
      return r?.["@type"] === "AggregateOffer" && r.offers ? ([] as unknown[]).concat(r.offers) : [r];
    }) as Record<string, unknown>[];
    for (const o of offers) {
      if (!o) continue;
      const specs = ([] as Record<string, unknown>[]).concat((o.priceSpecification as Record<string, unknown>) ?? []);
      const spec = specs.find((s) => !/strikethrough|listprice/i.test(str(s.priceType) ?? ""));
      // The store's own struck-through price: a StrikethroughPrice or ListPrice
      // specification. AggregateOffer's highPrice is the dearest variant, not
      // a former price, so it never counts.
      const struck = specs.find((s) => /strikethrough|listprice/i.test(str(s.priceType) ?? ""));
      const raw = o.price ?? o.lowPrice ?? spec?.price;
      const price = typeof raw === "number" ? Math.round(raw * 100) : str(raw) ? toMinor(str(raw)!) : 0;
      const currency = str(o.priceCurrency ?? spec?.priceCurrency)?.toUpperCase();
      const cond = schemaCondition(o.itemCondition ?? n.itemCondition);
      if (!price || !currency || cond === "refuse") continue;
      const wasRaw = struck?.price;
      const was = typeof wasRaw === "number" ? Math.round(wasRaw * 100) : str(wasRaw) ? toMinor(str(wasRaw)!) : 0;
      const sameCurrency = !struck?.priceCurrency || str(struck.priceCurrency)?.toUpperCase() === currency;
      const availability = schemaAvailability(str(o.availability));
      out.push({ title, gtin, mpn: str(n.mpn), sku: str(o.sku ?? n.sku), price, currency, inStock: availability ? availableNow(availability, false) : inStockOf(o.availability), condition: cond, ...extras(sameCurrency ? wasPriceOf(price, was) : null, availability, description), ...(image ? { image } : {}) });
    }
  }
  if (out.length) return out;
  const meta = (p: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*content=["']([^"']+)`, "i"))?.[1];
  const amount = meta("product:price:amount");
  const currency = meta("product:price:currency");
  const title = meta("og:title");
  if (amount && currency && title) {
    const av = meta("product:availability") ?? "";
    const availability = /pre-?order/i.test(av) ? "preorder" : /back ?order/i.test(av) ? "backorder" : /out ?of ?stock|oos/i.test(av) ? "out_of_stock" : /in ?stock/i.test(av) ? "in_stock" : null;
    out.push({ title: decode(title), price: toMinor(amount), currency: currency.toUpperCase(), inStock: availability ? availableNow(availability, false) : !/out ?of ?stock|oos/i.test(av), condition: schemaCondition(meta("product:condition")) as Condition | null, ...extras(null, availability) });
  }
  return out;
}

export const structuredSource = (retailerKey: string): PriceSource => ({
  retailer: retailerKey,
  async run({ market, retailer: r, index, lenses, now, log }) {
    const cfg = r.structured;
    if (!cfg) return { status: "skipped", note: "no structured-data config" };
    const origin = new URL(r.site).origin;
    const robotsRes = await get(`${origin}/robots.txt`).catch((e) => ({ status: 0, headers: new Headers(), text: String(e) }));
    const blocked = blockedReason(robotsRes.status, robotsRes.headers, robotsRes.text);
    if (blocked || robotsRes.status === 0 || robotsRes.status >= 500) return { status: "error", note: `robots.txt ${blocked ?? robotsRes.status}: not crawling` };
    const robots = robotsRes.status === 200 ? robotsRes.text : "";
    const delayLine = robots.match(/^\s*crawl-delay\s*:\s*([\d.]+)/im);
    const delay = Math.max(cfg.delayMs ?? 1500, delayLine ? Math.min(Number(delayLine[1]) * 1000, 10000) : 0);
    const queue = cfg.sitemaps ?? [...robots.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]);
    if (!queue.length) queue.push(`${origin}/sitemap.xml`);
    const pages = new Set<string>();
    const slot = Math.floor(Date.parse(now) / (6 * 3600_000));
    for (let n = 0; queue.length && n < MAX_SITEMAPS; n++) {
      const url = queue.shift()!;
      const s = await get(url).catch(() => null);
      await sleep(delay);
      if (!s || s.status !== 200) continue;
      const l = locs(s.text);
      if (/<sitemapindex/i.test(s.text)) {
        const re = cfg.sitemapFilter ?? /product/i;
        let pick = l.filter((u) => re.test(u));
        if (!pick.length) pick = l;
        if (cfg.sitemapWindow && pick.length > cfg.sitemapWindow) {
          const start = (slot * cfg.sitemapWindow) % pick.length;
          pick = [...pick.slice(start), ...pick.slice(0, start)].slice(0, cfg.sitemapWindow);
        }
        queue.push(...pick);
      } else for (const u of l) pages.add(u);
    }
    // Only pages for products we list, and only where robots.txt allows.
    const byProduct = new Map<string, string[]>();
    for (const u of pages) {
      let url: URL;
      try {
        url = new URL(u);
      } catch {
        continue;
      }
      if (url.origin !== origin || (cfg.urlFilter && !cfg.urlFilter.test(u)) || !robotsAllows(robots, url.pathname + url.search)) continue;
      // Slugless: keyed by URL, matched once the page is read.
      const key = cfg.slugless ? u : matchListing({ title: slugText(u) }, index).product?.slug;
      if (!key) continue;
      (byProduct.get(key) ?? byProduct.set(key, []).get(key)!).push(u);
    }
    // Rotate through the candidates, a budget per run, so every product is
    // re-read within a day at four runs a day; products not read this run keep
    // their earlier offers (`covered`).
    // Slugless candidates are shuffled per run instead (a stable hash of URL
    // and slot), so a window larger than the budget is sampled evenly over runs.
    const hash = (x: string) => [...x].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, slot);
    const all = cfg.slugless ? [...byProduct.keys()].sort((a, b) => hash(a) - hash(b)) : [...byProduct.keys()].sort();
    const budget = cfg.budget ?? 250;
    const urls: [string, string][] = all.flatMap((p) => byProduct.get(p)!.slice(0, 3).map((u) => [p, u] as [string, string]));
    const start = urls.length > budget && !cfg.slugless ? (slot * budget) % urls.length : 0;
    const window = [...urls.slice(start), ...urls.slice(0, start)].slice(0, budget);
    const currency = MARKETS[market].currency;
    const offers: Offer[] = [];
    const accessories: AccessoryOffer[] = [];
    // Budget the catalog left unused goes to accessory pages (src/lib/accessories.ts).
    const spare = spareAccessoryUrls(pages, ((taken) => (u: string) => !taken.has(u))(new Set(urls.map(([, x]) => x))), origin, robots, cfg.urlFilter, Math.min(60, budget - window.length), slot);
    const covered = new Set<string>();
    let fetched = 0;
    let stop = "";
    for (const [, u] of [...window, ...spare]) {
      const p = await get(u).catch(() => null);
      await sleep(delay);
      if (!p) continue;
      const why = blockedReason(p.status, p.headers, p.text);
      if (why) {
        stop = `stopped after ${fetched} pages: ${why}`;
        break;
      }
      fetched++;
      if (p.status !== 200) continue;
      const branch = cfg.branch ? (cfg.branch.exec(p.text)?.[1] ?? null) : null;
      for (const l of pageListings(p.text)) {
        // A page priced in another currency is refused, never converted.
        if (l.currency !== currency) continue;
        const m = matchListing({ title: l.title, gtin: l.gtin, mpn: l.mpn }, index);
        if (!m.product) {
          const a = accessoryOffer({ title: l.title, price: l.price, currency, url: u, inStock: l.inStock, condition: l.condition ?? shopifyCondition({ title: `${l.title} ${slugText(u)}` }, ""), sourceId: l.sku ?? null, image: absolute(l.image, u) }, index, r.key, now);
          if (a && !accessories.some((x) => x.url === u && x.title === a.title)) accessories.push(a);
          continue;
        }
        covered.add(m.product.slug);
        const fromTitle = shopifyCondition({ title: `${l.title} ${slugText(u)}` }, "");
        const cond = fromTitle !== "new" ? fromTitle : (l.condition ?? "new");
        if (!r.conditions.includes(cond) || !plausiblePrice(m.product, cond, l.price / 100, currency, m.via)) continue;
        const kit = m.kit && m.kind === "camera" ? kitLensOf(l.title, index, lenses, m.product) : null;
        offers.push({
          product: m.product.slug,
          kind: m.kind,
          retailer: r.key,
          condition: cond,
          price: l.price,
          currency,
          url: u,
          title: l.title,
          seller: null,
          inStock: l.inStock,
          kit: m.kit,
          mount: m.mount,
          seenAt: now,
          sourceId: l.sku ?? null,
          wasPrice: l.wasPrice ?? null,
          availability: l.availability ?? null,
          kitLens: kit?.kitLens ?? null,
          kitLensName: kit?.kitLensName ?? null,
          promo: promoOf({ title: l.title, body: l.description }),
          detail: detailOf({ branch: branch ? decode(branch) : null, title: l.title, text: cond === "new" ? null : l.description, used: cond !== "new" }),
          ...secondHandImage(cond, absolute(l.image, u)),
        });
      }
    }
    if (!cfg.slugless) for (const [p] of window.slice(0, fetched)) covered.add(p);
    const note = `${pages.size} sitemap URLs, ${urls.length} candidates, ${fetched} pages read${stop ? `; ${stop}` : ""}`;
    log(`${r.key}: ${note}, ${offers.length} offers`);
    if (!fetched && window.length) return { status: "error", note };
    return { status: "ok", offers: cheapestPerProduct(offers), covered: [...covered], note, accessories };
  },
});

/** Sitemap URLs whose slug reads as a camera accessory, rotated per run, up to `n`. */
function spareAccessoryUrls(pages: Set<string>, keep: (u: string) => boolean, origin: string, robots: string, filter: RegExp | undefined, n: number, slot: number): [string, string][] {
  if (n <= 0) return [];
  const out: string[] = [];
  for (const u of pages) {
    let url: URL;
    try {
      url = new URL(u);
    } catch {
      continue;
    }
    if (url.origin !== origin || (filter && !filter.test(u)) || !robotsAllows(robots, url.pathname + url.search) || !keep(u)) continue;
    if (classifyAccessory({ title: slugText(u) })) out.push(u);
  }
  out.sort();
  const start = out.length > n ? (slot * n) % out.length : 0;
  return [...out.slice(start), ...out.slice(0, start)].slice(0, n).map((u) => ["", u]);
}
