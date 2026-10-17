import { product as getProduct } from "@/lib/catalog";
import type { MarketCode } from "@/lib/markets";
import type { Offer } from "@/lib/offers";
import { ebayRows, ebaySearch, packKind } from "@/lib/offer-rows";
import { ebayFor } from "@/lib/retailers";
import { EbayListings } from "./OfferRows";
import OutboundLink from "./OutboundLink";

/**
 * eBay beside the dealer rows (RiftCompare's layout): today's cheapest
 * fixed-price listings from the Browse API, and a tagged search of the
 * market's eBay site. Without live listings it renders nothing: the search
 * link is then in the "Also check" box (OffersTable).
 */
export default function EbayPanel({ product, query, offers, market, page }: { product: string; query: string; offers: Offer[]; market: MarketCode; page: string }) {
  const r = ebayFor(market);
  const p = getProduct(product);
  const listings = ebayRows(offers, market, { page, placement: "ebay", pack: p ? packKind(p) : "lens" });
  if (!r || !listings.length) return null;
  const all = ebaySearch(query, market, page, "ebay-search", listings);
  const paid = listings.some((o) => o.paid) || Boolean(all?.paid);
  return (
    <aside className="card flex flex-col gap-3 p-4" aria-label="On eBay">
      <div className="flex items-baseline justify-between">
        <h3 className="font-bold">On {r.name}</h3>
        {paid && <span className="text-[10px] text-subtle">Paid links</span>}
      </div>
      <EbayListings listings={listings} product={product} placement="ebay-listing" />
      {all && (
        <OutboundLink href={all.href} retailer={r.key} product={product} placement="ebay-search" className={all.paid ? "btn-ebay" : "btn-ghost"}>
          {all.cta}
        </OutboundLink>
      )}
    </aside>
  );
}
