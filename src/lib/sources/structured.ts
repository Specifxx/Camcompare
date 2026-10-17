// Structured data from a retailer's own product pages, for shops with no
// feed or API yet (owner, 2026-10-17: "we need the live prices"). The site's
// robots.txt names its sitemaps; product URLs whose slug the matcher reads as
// a catalog product are fetched politely (one at a time, a delay between
// requests, a per-run budget), and the page's schema.org JSON-LD Product /
// Offer (or OpenGraph product:price) gives price, currency, stock and
// condition. Never Amazon or eBay, never a path robots.txt disallows, never
// past bot protection: a 403/429/challenge stops the run.
import { gunzipSync } from "node:zlib";
import { matchListing, plausiblePrice } from "../matching";
import { MARKETS } from "../markets";
import type { Offer } from "../offers";
import type { Condition } from "../retailers";
import { cheapestPerProduct } from "./feed";
import { robotsAllows, shopifyCondition } from "./shopify";
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
  /** Product pages per run (default 250). */
  budget?: number;
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

export type PageListing = { title: string; gtin?: string; mpn?: string; sku?: string; price: number; currency: string; inStock: boolean; condition: Condition | null };

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
    const gtin = str(n.gtin13 ?? n.gtin12 ?? n.gtin14 ?? n.gtin ?? n.gtin8);
    const offers = ([] as unknown[]).concat(n.offers ?? []).flatMap((o) => {
      const r = o as Record<string, unknown>;
      return r?.["@type"] === "AggregateOffer" && r.offers ? ([] as unknown[]).concat(r.offers) : [r];
    }) as Record<string, unknown>[];
    for (const o of offers) {
      if (!o) continue;
      const spec = ([] as Record<string, unknown>[]).concat((o.priceSpecification as Record<string, unknown>) ?? []).find((s) => !/strikethrough|listprice/i.test(str(s.priceType) ?? ""));
      const raw = o.price ?? o.lowPrice ?? spec?.price;
      const price = typeof raw === "number" ? Math.round(raw * 100) : str(raw) ? toMinor(str(raw)!) : 0;
      const currency = str(o.priceCurrency ?? spec?.priceCurrency)?.toUpperCase();
      const cond = schemaCondition(o.itemCondition ?? n.itemCondition);
      if (!price || !currency || cond === "refuse") continue;
      out.push({ title, gtin, mpn: str(n.mpn), sku: str(o.sku ?? n.sku), price, currency, inStock: inStockOf(o.availability), condition: cond });
    }
  }
  if (out.length) return out;
  const meta = (p: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*content=["']([^"']+)`, "i"))?.[1];
  const amount = meta("product:price:amount");
  const currency = meta("product:price:currency");
  const title = meta("og:title");
  if (amount && currency && title) out.push({ title: decode(title), price: toMinor(amount), currency: currency.toUpperCase(), inStock: !/out ?of ?stock|oos/i.test(meta("product:availability") ?? ""), condition: schemaCondition(meta("product:condition")) as Condition | null });
  return out;
}

export const structuredSource = (retailerKey: string): PriceSource => ({
  retailer: retailerKey,
  async run({ market, retailer: r, index, now, log }) {
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
    for (let n = 0; queue.length && n < MAX_SITEMAPS; n++) {
      const url = queue.shift()!;
      const s = await get(url).catch(() => null);
      await sleep(delay);
      if (!s || s.status !== 200) continue;
      const l = locs(s.text);
      if (/<sitemapindex/i.test(s.text)) {
        const re = cfg.sitemapFilter ?? /product/i;
        const pick = l.filter((u) => re.test(u));
        queue.push(...(pick.length ? pick : l));
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
      const m = matchListing({ title: slugText(u) }, index);
      if (!m.product) continue;
      (byProduct.get(m.product.slug) ?? byProduct.set(m.product.slug, []).get(m.product.slug)!).push(u);
    }
    // Rotate through the candidates, a budget per run, so every product is
    // re-read within a day at four runs a day; products not read this run keep
    // their earlier offers (`covered`).
    const all = [...byProduct.keys()].sort();
    const budget = cfg.budget ?? 250;
    const slot = Math.floor(Date.parse(now) / (6 * 3600_000));
    const urls: [string, string][] = all.flatMap((p) => byProduct.get(p)!.slice(0, 3).map((u) => [p, u] as [string, string]));
    const start = urls.length > budget ? (slot * budget) % urls.length : 0;
    const window = [...urls.slice(start), ...urls.slice(0, start)].slice(0, budget);
    const currency = MARKETS[market].currency;
    const offers: Offer[] = [];
    const covered = new Set<string>();
    let fetched = 0;
    let stop = "";
    for (const [, u] of window) {
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
      for (const l of pageListings(p.text)) {
        // A page priced in another currency is refused, never converted.
        if (l.currency !== currency) continue;
        const m = matchListing({ title: l.title, gtin: l.gtin, mpn: l.mpn }, index);
        if (!m.product) continue;
        covered.add(m.product.slug);
        const fromTitle = shopifyCondition({ title: `${l.title} ${slugText(u)}` }, "");
        const cond = fromTitle !== "new" ? fromTitle : (l.condition ?? "new");
        if (!r.conditions.includes(cond) || !plausiblePrice(m.product, cond, l.price / 100, currency, m.via)) continue;
        offers.push({ product: m.product.slug, kind: m.kind, retailer: r.key, condition: cond, price: l.price, currency, url: u, title: l.title, seller: null, inStock: l.inStock, kit: m.kit, mount: m.mount, seenAt: now, sourceId: l.sku ?? null });
      }
    }
    for (const [p] of window.slice(0, fetched)) covered.add(p);
    const note = `${pages.size} sitemap URLs, ${urls.length} candidates, ${fetched} pages read${stop ? `; ${stop}` : ""}`;
    log(`${r.key}: ${note}, ${offers.length} offers`);
    if (!fetched && window.length) return { status: "error", note };
    return { status: "ok", offers: cheapestPerProduct(offers), covered: [...covered], note };
  },
});
