// A tagged eBay search whose words are filled in the browser: the server
// wraps the link once with affiliateUrl (lib/ebay-links.ts ebayTemplate),
// keeping this placeholder as the search words, and a client component puts
// the visitor's choice in (the accessory page's camera filter, My gear's
// items). The campaign, rotation id and customid are already on it.
// Client-safe.
export const EBAY_QUERY_SLOT = "__ccq__";

export type EbayTemplate = { href: string; paid: boolean; retailer: string; name: string };

/** The template with its search words: "+" for spaces, as eBay's own search writes them. */
export function fillEbay(template: string, query: string): string {
  return template.replace(EBAY_QUERY_SLOT, encodeURIComponent(query.trim().replace(/α/g, "a")).replace(/%20/g, "+"));
}
