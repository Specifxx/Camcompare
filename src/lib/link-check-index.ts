// "Is this a good price?" (2026-11-08): each store's listings for /check/<host>, built at the release's build from the
// committed offer files (data/offers/<market>.json), keyed by the host each listing links to. A static file per host, never
// a function, and the store's page is never fetched. Amazon (its prices are never committed), eBay and marketplaces are never
// a store here. Each product key is "<market>:<slug>:<condition>:<0, or kit-<its lens>>:<mount>", so a used body, a new body, a kit with one lens and a
// lens for another mount are four prices; its cheapest and median come from the in-stock store prices in that market.
import { displayName, product } from "./catalog";
import { linkPath, medianCents, normaliseHost, variantOf, type CheckOffer, type CheckProduct, type StoreCheck } from "./link-check";
import { MARKET_CODES, MARKETS, marketPath, type MarketCode } from "./markets";
import { readOffersFile, type Offer } from "./offers";
import { CONDITION_LABEL, retailer } from "./retailers";

/** A host is safe as a URL segment and a static file name. */
export const CHECK_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

const isStore = (o: Offer) => {
  const r = retailer(o.retailer);
  return !!r && !r.amazon && !r.ebay && r.source !== "link-only" && o.seller == null && o.price > 0;
};

let built: Map<string, StoreCheck> | null = null;

export function storeChecks(read: (m: MarketCode) => { generatedAt: string | null; offers: Offer[] } = readOffersFile): Map<string, StoreCheck> {
  if (built && read === readOffersFile) return built;
  type B = { offers: CheckOffer[]; products: Record<string, CheckProduct>; stores: Map<string, number>; markets: Map<MarketCode, number>; at: Map<MarketCode, string | null> };
  const byHost = new Map<string, B>();
  for (const m of MARKET_CODES) {
    const file = read(m);
    const groups = new Map<string, Offer[]>();
    for (const o of file.offers) {
      if (!isStore(o)) continue;
      const key = `${m}:${o.product}:${o.condition}:${o.kit ? `kit-${o.kitLens ?? ""}` : 0}:${o.kind === "lens" ? (o.mount ?? "") : ""}`;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(o);
    }
    for (const [key, list] of groups) {
      const p = product(list[0].product);
      if (!p) continue;
      const open = list.filter((o) => o.inStock);
      const prices = open.map((o) => o.price);
      const extras = [list[0].condition === "new" ? null : CONDITION_LABEL[list[0].condition], list[0].kit ? "kit" : null].filter(Boolean).join(", ");
      const item: CheckProduct = {
        name: `${displayName(p.item, m)}${extras ? ` (${extras})` : ""}`,
        href: marketPath(m, `/${p.kind === "camera" ? "cameras" : "lenses"}/${p.item.slug}`),
        cheapestCents: prices.length ? Math.min(...prices) : null,
        medianCents: prices.length >= 2 ? medianCents(prices) : null,
        inStockStores: new Set(open.map((o) => o.retailer)).size,
        listedStores: new Set(list.map((o) => o.retailer)).size,
      };
      for (const o of list) {
        let u: URL;
        try {
          u = new URL(o.url);
        } catch {
          continue;
        }
        const host = normaliseHost(u.hostname);
        if (!CHECK_HOST.test(host)) continue;
        let b = byHost.get(host);
        if (!b) byHost.set(host, (b = { offers: [], products: {}, stores: new Map(), markets: new Map(), at: new Map() }));
        b.products[key] = item;
        b.offers.push([linkPath(u.pathname), key, o.price, o.inStock ? 1 : 0, variantOf(o.url)]);
        b.stores.set(o.retailer, (b.stores.get(o.retailer) ?? 0) + 1);
        b.markets.set(m, (b.markets.get(m) ?? 0) + 1);
        b.at.set(m, file.generatedAt);
      }
    }
  }
  const most = <K,>(x: Map<K, number>): K => [...x.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const out = new Map<string, StoreCheck>();
  for (const [host, b] of byHost) {
    const store = most(b.stores);
    const region = most(b.markets);
    out.set(host, { v: 1, store, name: retailer(store)?.name ?? host, region, currency: MARKETS[region].currency, checkedAt: b.at.get(region) ?? null, offers: b.offers, products: b.products });
  }
  if (read === readOffersFile) built = out;
  return out;
}
