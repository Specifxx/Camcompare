// Shopify stores publish their catalogue at /products.json (and per
// collection at /collections/<handle>/products.json). RiftCompare prices
// 200+ card shops this way (src/lib/price-import.ts there); CamCompare uses
// it only for camera shops that run Shopify, never past a robots.txt
// Disallow, at one request every ~half second, with a contact header.
// `country=` asks Shopify Markets for the market's own price.
import { matchListing, plausiblePrice } from "../matching";
import { MARKETS } from "../markets";
import type { Offer } from "../offers";
import type { Condition } from "../retailers";
import { sleep, toMinor, type PriceSource } from "./types";

const UA = "Mozilla/5.0 (compatible; CamCompareBot/0.1; +https://github.com/Specifxx/Camcompare)";
const MAX_PAGES = 60;

type Variant = { id: number; title: string; price: string; available: boolean; sku?: string | null };
type Product = { id: number; title: string; handle: string; product_type?: string; tags?: string[] | string; variants: Variant[] };

/** Is `path` allowed for every user agent by this robots.txt? Conservative: any matching Disallow refuses. */
export function robotsAllows(robots: string, path: string): boolean {
  let applies = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^(user-agent|disallow|allow)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [, field, value] = m;
    if (/^user-agent$/i.test(field)) applies = value === "*" || /camcompare/i.test(value);
    else if (applies && /^disallow$/i.test(field) && value && path.startsWith(value.replace(/\*.*$/, ""))) return false;
  }
  return true;
}

export function shopifyCondition(p: Pick<Product, "title" | "product_type" | "tags">, variantTitle: string): Condition {
  const text = `${p.title} ${variantTitle} ${p.product_type ?? ""} ${Array.isArray(p.tags) ? p.tags.join(" ") : p.tags ?? ""}`.toLowerCase();
  if (/\brefurb/.test(text)) return "refurbished";
  if (/\b(used|pre-?owned|second-?hand|preloved|trade-?in)\b/.test(text)) return "used";
  if (/\b(ex-?demo|demo unit|open box|open-box|display unit)\b/.test(text)) return "open-box";
  return "new";
}

export const shopifySource = (retailerKey: string): PriceSource => ({
  retailer: retailerKey,
  async run({ market, retailer: r, index, now, log }) {
    if (!r.shopify) return { status: "skipped", note: "no Shopify config" };
    const base = r.shopify.base.replace(/\/$/, "");
    const robots = await fetch(`${base}/robots.txt`, { headers: { "User-Agent": UA } }).then((x) => (x.ok ? x.text() : ""), () => "");
    const paths = (r.shopify.collections?.length ? r.shopify.collections.map((c) => `/collections/${c}/products.json`) : ["/products.json"]).filter((p) => robotsAllows(robots, p));
    if (!paths.length) return { status: "skipped", note: "robots.txt disallows products.json" };
    const currency = MARKETS[market].currency;
    const offers: Offer[] = [];
    let seen = 0;
    for (const path of paths) {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await fetch(`${base}${path}?limit=250&page=${page}&country=${r.country}`, { headers: { "User-Agent": UA, From: "camcompare-bot@users.noreply.github.com" } });
        if (res.status === 429 || res.status === 403) throw new Error(`${res.status} on ${path} page ${page}`);
        if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) throw new Error(`${res.status} non-JSON on ${path}`);
        const products = ((await res.json()) as { products?: Product[] }).products ?? [];
        if (!products.length) break;
        for (const p of products) {
          for (const v of p.variants) {
            seen++;
            const title = v.title && v.title !== "Default Title" ? `${p.title} ${v.title}` : p.title;
            const m = matchListing({ title, mpn: v.sku }, index);
            if (!m.product) continue;
            const cond = shopifyCondition(p, v.title);
            const price = toMinor(v.price);
            if (!price || !plausiblePrice(m.product, cond, price / 100, currency, m.via)) continue;
            offers.push({
              product: m.product.slug,
              kind: m.kind,
              retailer: r.key,
              condition: cond,
              price,
              currency,
              url: `${base}/products/${p.handle}?variant=${v.id}`,
              title,
              seller: null,
              inStock: v.available,
              kit: m.kit,
              mount: m.mount,
              seenAt: now,
              sourceId: String(v.id),
            });
          }
        }
        await sleep(500);
      }
    }
    log(`${r.key}: ${seen} variants, ${offers.length} matched`);
    return { status: "ok", offers, note: `${seen} variants` };
  },
});
