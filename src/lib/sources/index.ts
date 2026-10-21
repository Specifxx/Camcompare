import type { MarketCode } from "../markets";
import { RETAILERS } from "../retailers";
import { amazonSource } from "./amazon";
import { bestBuySource } from "./bestbuy";
import { ebaySource } from "./ebay";
import { feedSource } from "./feed";
import { shopifySource } from "./shopify";
import { structuredSource } from "./structured";
import type { PriceSource } from "./types";

export function sourcesFor(market: MarketCode): PriceSource[] {
  return RETAILERS.filter((r) => r.market === market).flatMap((r) => {
    switch (r.source) {
      case "amazon-creators":
        return [amazonSource(r.key)];
      case "ebay-browse":
        return [ebaySource(r.key)];
      case "bestbuy-api":
        return [bestBuySource(r.key)];
      case "feed": {
        // A feed retailer with a structured-data or Shopify fallback reads its
        // pages until its FEED_URL_* secret exists; then the feed alone (never both).
        const feed = feedSource(r.key);
        if (!r.structured && !r.shopify) return [feed];
        const env = `FEED_URL_${r.key.toUpperCase().replace(/-/g, "_")}`;
        const pages = r.structured ? structuredSource(r.key) : shopifySource(r.key);
        return [{ retailer: r.key, run: (ctx) => (process.env[env] ? feed.run(ctx) : pages.run(ctx)) }];
      }
      case "structured":
        return [structuredSource(r.key)];
      case "shopify":
        return [shopifySource(r.key)];
      default:
        return [];
    }
  });
}
