// Which market's product page asks to be indexed (SEO audit, 2026-11-07). The US page is the catalogue's
// home (specs, comparisons, history) and is always indexable. A page in another market is a copy of it plus
// that market's price table, so it earns its own place in Google only with a real comparison there: three or
// more stores listing it (Amazon is left out of the count: its prices are fetched at build, never committed,
// so the count would change between builds). Below that it is noindex, follow, out of the sitemap and out of
// hreflang, and links to it are nofollow; it stays live for a visitor who picks that market. The product page's
// robots tag, hreflang, the sitemap and the summaries all ask this one function. DECISIONS.md, 2026-11-07.
import { offersFor } from "./catalog";
import type { MarketCode } from "./markets";
import { isAmazonOffer, type Offer } from "./offers";

/** Stores (not Amazon) a market needs listing a product before its page there is indexable. */
export const MIN_MARKET_STORES = 3;

/** Distinct stores among offers, Amazon left out. */
export const storeCount = (offers: readonly Offer[]): number => new Set(offers.filter((o) => !isAmazonOffer(o)).map((o) => o.retailer)).size;

/** Pure: the rule for a market given its offers. */
export const indexableWith = (m: MarketCode, offers: readonly Offer[]): boolean => m === "us" || storeCount(offers) >= MIN_MARKET_STORES;

/** A product page in market `m` is indexable (and in the sitemap and hreflang). */
export const productIndexable = (slug: string, m: MarketCode): boolean => indexableWith(m, offersFor(slug, m));
