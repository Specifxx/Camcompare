import type { MarketCode } from "../markets";
import { RETAILERS } from "../retailers";
import { amazonSource } from "./amazon";
import { ebaySource } from "./ebay";
import { feedSource } from "./feed";
import { shopifySource } from "./shopify";
import type { PriceSource } from "./types";

export function sourcesFor(market: MarketCode): PriceSource[] {
  return RETAILERS.filter((r) => r.market === market).flatMap((r) => {
    switch (r.source) {
      case "amazon-creators":
        return [amazonSource(r.key)];
      case "ebay-browse":
        return [ebaySource(r.key)];
      case "feed":
        return [feedSource(r.key)];
      case "shopify":
        return [shopifySource(r.key)];
      default:
        return [];
    }
  });
}
