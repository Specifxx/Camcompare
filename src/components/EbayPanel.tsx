import { affiliateUrl, isPaid, subId } from "@/lib/affiliate";
import { price } from "@/lib/format";
import type { MarketCode } from "@/lib/markets";
import type { Offer } from "@/lib/offers";
import { CONDITION_LABEL, ebayFor } from "@/lib/retailers";
import OutboundLink from "./OutboundLink";

/**
 * eBay beside the dealer list (RiftCompare's layout): today's cheapest
 * fixed-price listings when the Browse API is connected, and always a
 * search of the market's eBay site, tagged with the EPN campaign. The search
 * link earns from day one; listings appear once EBAY_CLIENT_ID is set.
 */
export default function EbayPanel({ product, query, offers, market, page }: { product: string; query: string; offers: Offer[]; market: MarketCode; page: string }) {
  const r = ebayFor(market);
  if (!r || !r.searchUrl) return null;
  const listings = offers.filter((o) => o.retailer === r.key && o.inStock).sort((a, b) => a.price - b.price).slice(0, 4);
  const paid = isPaid(r.key);
  return (
    <aside className="card flex flex-col gap-3 p-4" aria-label="On eBay">
      <div className="flex items-baseline justify-between">
        <h3 className="font-bold">On {r.name}</h3>
        {paid && <span className="text-[10px] text-subtle">Paid links</span>}
      </div>
      {listings.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {listings.map((o) => (
            <li key={o.sourceId ?? o.url}>
              <OutboundLink href={affiliateUrl(r.key, o.url, subId(page, "ebay"))} retailer={r.key} product={product} placement="ebay-listing" className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm text-fg no-underline hover:border-accent hover:no-underline">
                <span className="min-w-0">
                  <span className="block text-xs text-muted">{CONDITION_LABEL[o.condition]}{o.seller ? ` · ${o.seller}` : ""}</span>
                </span>
                <span className="price shrink-0 font-bold">{price(o.price, o.currency)}</span>
              </OutboundLink>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">New and used listings from eBay sellers, including auctions. Check the seller&apos;s feedback and returns before you buy.</p>
      )}
      <OutboundLink href={affiliateUrl(r.key, r.searchUrl(query), subId(page, "ebay-search"))} retailer={r.key} product={product} placement="ebay-search" className={paid ? "btn-ebay" : "btn-ghost"}>
        {listings.length ? "See all on eBay" : "Search eBay"}
      </OutboundLink>
    </aside>
  );
}
