// Best Buy Products API (US): a free key from developer.bestbuy.com,
// 5 requests a second. One keyword search per product; every result still
// has to pass lib/matching.ts as that product. Best Buy's affiliate
// programme runs on Impact (AFFILIATE_DEEPLINK_BESTBUY).
// NOTE: written from the public API docs, not yet run with a live key.
import { matchListing, plausiblePrice } from "../matching";
import type { Offer } from "../offers";
import type { Condition } from "../retailers";
import { searchPhrase, sleep, type PriceSource } from "./types";

type Product = { sku: number; name: string; upc?: string; salePrice?: number; regularPrice?: number; onlineAvailability?: boolean; url?: string; condition?: string };

const condition = (c: string | undefined): Condition | null => {
  const s = (c ?? "New").toLowerCase();
  if (s.startsWith("new")) return "new";
  if (s.includes("refurb")) return "refurbished";
  if (s.includes("pre-owned") || s.includes("used")) return "used";
  if (s.includes("open")) return "open-box";
  return null;
};

/** "Sony a7 IV" → `(search=sony&search=a7&search=iv)`: every word must match. */
export function bestBuyQuery(phrase: string): string {
  const words = phrase.toLowerCase().replace(/[^a-z0-9.\- ]+/g, " ").split(/\s+/).filter((w) => w.length > 0).slice(0, 6);
  return `(${words.map((w) => `search=${encodeURIComponent(w)}`).join("&")})`;
}

export const bestBuySource = (retailerKey: string): PriceSource => ({
  retailer: retailerKey,
  async run({ retailer: r, cameras, lenses, index, now, log }) {
    const key = process.env.BESTBUY_API_KEY || "";
    if (!key) return { status: "skipped", note: "BESTBUY_API_KEY not set" };
    const offers: Offer[] = [];
    const products = [...cameras.map((c) => ({ kind: "camera" as const, item: c })), ...lenses.map((l) => ({ kind: "lens" as const, item: l }))].filter((p) => p.item.status === "current");
    let calls = 0;
    for (const { kind, item } of products) {
      const url = `https://api.bestbuy.com/v1/products${bestBuyQuery(searchPhrase(item))}?apiKey=${key}&format=json&pageSize=10&show=sku,name,upc,salePrice,regularPrice,onlineAvailability,url,condition`;
      const res = await fetch(url);
      calls++;
      await sleep(220);
      if (res.status === 403 || res.status === 429) {
        log(`${r.key}: ${res.status} after ${calls} calls`);
        if (calls === 1) throw new Error(`Best Buy API ${res.status}`);
        break;
      }
      if (!res.ok) continue;
      for (const p of ((await res.json()) as { products?: Product[] }).products ?? []) {
        const cond = condition(p.condition);
        const price = p.salePrice ?? p.regularPrice;
        if (!cond || !price || !p.url) continue;
        const m = matchListing({ title: p.name, gtin: p.upc }, index, kind);
        if (!m.product || m.product.slug !== item.slug) continue;
        if (!plausiblePrice(m.product, cond, price, "USD")) continue;
        offers.push({
          product: item.slug,
          kind,
          retailer: r.key,
          condition: cond,
          price: Math.round(price * 100),
          currency: "USD",
          url: p.url,
          title: p.name,
          seller: null,
          inStock: p.onlineAvailability !== false,
          kit: m.kit,
          mount: m.mount,
          seenAt: now,
          sourceId: String(p.sku),
        });
      }
    }
    return { status: "ok", offers, note: `${calls} API calls` };
  },
});
