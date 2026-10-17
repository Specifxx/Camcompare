// Shopify stores publish their catalogue at /products.json (and per
// collection at /collections/<handle>/products.json). RiftCompare prices
// 200+ card shops this way (src/lib/price-import.ts there); CamCompare uses
// it only for camera shops that run Shopify, never past a robots.txt
// Disallow, at one request every ~half second, with a contact header.
// `country=` asks Shopify Markets for the market's own price, and the
// store's currency (/meta.json) must be the market's.
import { accessoryOffer, type AccessoryOffer } from "../accessories";
import { matchListing, plausiblePrice } from "../matching";
import { MARKETS } from "../markets";
import type { Offer } from "../offers";
import type { Condition } from "../retailers";
import { sleep, toMinor, type PriceSource } from "./types";

const UA = "Mozilla/5.0 (compatible; CamCompareBot/0.1; +https://github.com/Specifxx/Camcompare)";
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

type Variant = { id: number; title: string; price: string; available: boolean; sku?: string | null };
type Product = { id: number; title: string; handle: string; vendor?: string; product_type?: string; tags?: string[] | string; variants: Variant[] };

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

export function shopifyCondition(p: Pick<Product, "title" | "product_type" | "tags">, variantTitle: string): Condition {
  const text = `${p.title} ${variantTitle} ${p.product_type ?? ""} ${Array.isArray(p.tags) ? p.tags.join(" ") : p.tags ?? ""}`.toLowerCase();
  if (/\brefurb/.test(text)) return "refurbished";
  // Before "used": an "Open Box" listing is often also tagged used.
  if (/\b(ex-?demo|demo unit|open box|open-box|display unit)\b/.test(text)) return "open-box";
  if (/\b(used|pre-?owned|second-?hand|preloved|trade-?in)\b/.test(text)) return "used";
  return "new";
}

export const shopifySource = (retailerKey: string): PriceSource => ({
  retailer: retailerKey,
  async run({ market, retailer: r, index, now, log }) {
    if (!r.shopify) return { status: "skipped", note: "no Shopify config" };
    if (r.shopify.disabled) return { status: "skipped", note: r.shopify.disabled };
    const base = r.shopify.base.replace(/\/$/, "");
    // RFC 9309: a missing robots.txt allows everything; one the server can't
    // serve (5xx) disallows everything until it can.
    const robotsRes = await politeGet(`${base}/robots.txt`, { "User-Agent": UA });
    if (robotsRes.status >= 500) throw new Error(`robots.txt ${robotsRes.status}`);
    const robots = robotsRes.ok ? await robotsRes.text() : "";
    const paths = (r.shopify.collections?.length ? r.shopify.collections.map((c) => `/collections/${c}/products.json`) : ["/products.json"]).filter((p) => robotsAllows(robots, `${p}?limit=250&page=1&country=${r.country}`));
    if (!paths.length) return { status: "skipped", note: "robots.txt disallows products.json" };
    // products.json names no currency, so the store's own (/meta.json) must be
    // the market's: another currency is refused, never converted.
    const currency = MARKETS[market].currency;
    if (!robotsAllows(robots, "/meta.json")) return { status: "skipped", note: "robots.txt disallows /meta.json: store currency unknown" };
    const meta = await politeGet(`${base}/meta.json`, { "User-Agent": UA }).then((x) => (x.ok ? (x.json() as Promise<{ currency?: string }>) : null)).catch(() => null);
    const storeCurrency = meta?.currency ?? r.shopify.currency;
    if (!storeCurrency) throw new Error("no store currency in /meta.json");
    if (storeCurrency !== currency) return { status: "skipped", note: `store charges in ${storeCurrency}, not ${currency}` };
    const offers: Offer[] = [];
    const accessories: AccessoryOffer[] = [];
    let seen = 0;
    for (const path of paths) {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await politeGet(`${base}${path}?limit=250&page=${page}&country=${r.country}`, { "User-Agent": UA, From: "camcompare-bot@users.noreply.github.com" });
        if (res.status === 429 || res.status === 403) throw new Error(`${res.status} on ${path} page ${page}`);
        if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) throw new Error(`${res.status} non-JSON on ${path}`);
        const products = ((await res.json()) as { products?: Product[] }).products ?? [];
        if (!products.length) break;
        for (const p of products) {
          for (const v of p.variants) {
            seen++;
            const title = v.title && v.title !== "Default Title" ? `${p.title} ${v.title}` : p.title;
            const named = r.shopify.brand && !title.toLowerCase().includes(r.shopify.brand.toLowerCase()) ? `${r.shopify.brand} ${title}` : title;
            const m = matchListing({ title: named, mpn: v.sku }, index);
            if (!m.product) {
              // Not a camera or lens: maybe an accessory (src/lib/accessories.ts).
              const a = accessoryOffer({ title, productType: p.product_type, vendor: p.vendor, price: toMinor(v.price), currency, url: `${base}/products/${p.handle}?variant=${v.id}`, inStock: v.available, condition: shopifyCondition(p, v.title), sourceId: String(v.id) }, index, r.key, now);
              if (a) accessories.push(a);
              continue;
            }
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
    log(`${r.key}: ${seen} variants, ${offers.length} matched, ${accessories.length} accessories`);
    return { status: "ok", offers, note: `${seen} variants`, accessories };
  },
});
