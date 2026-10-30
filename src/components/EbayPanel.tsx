import { product as getProduct } from "@/lib/catalog";
import { productEbayCategory, productEbayLinks } from "@/lib/ebay-links";
import type { MarketCode } from "@/lib/markets";
import type { Offer } from "@/lib/offers";
import { ebayRows, ebaySearch, packKind } from "@/lib/offer-rows";
import { ebayFor } from "@/lib/retailers";
import { EbayListings } from "./OfferRows";
import OutboundLink from "./OutboundLink";
import EbayText, { PaidTag } from "./ebay/EbayText";

/**
 * "On eBay", beside Where to buy and never inside its price-sorted list:
 * eBay's own sellers are single units, auctions and used, so they sit apart.
 * Today's cheapest live listings when the Browse API sends some, and always
 * three tagged searches: used, new, and recently sold (what it actually went
 * for, the "what should it be worth" question). Nothing in Singapore, where
 * eBay Partner Network has no programme.
 */
export default function EbayPanel({ product, query, name, offers, market, page }: { product: string; query: string; name: string; offers: Offer[]; market: MarketCode; page: string }) {
  const r = ebayFor(market);
  const p = getProduct(product);
  const links = productEbayLinks(query, name, market, page, "product", productEbayCategory(p?.kind === "camera" ? p.item.type : null));
  if (!r || !links) return null;
  const listings = ebayRows(offers, market, { page, placement: "ebay", pack: p ? packKind(p) : "lens" });
  const all = listings.length ? ebaySearch(query, market, page, "product-ebay-all", listings) : null;
  return (
    <aside className="card flex flex-col gap-3 p-4" aria-label="On eBay">
      <div>
        <h3 className="font-bold">On {r.name}</h3>
        <p className="mt-0.5 text-xs text-subtle">
          {listings.length ? "Today's cheapest from single sellers, apart from the stores' prices." : "Single sellers, used and new, auctions included. eBay's prices aren't listed here yet, so search them there."}
        </p>
      </div>
      {listings.length > 0 && <EbayListings listings={listings} product={product} placement="ebay-listing" />}
      {all && (
        <div>
          <OutboundLink href={all.href} retailer={r.key} product={product} placement="product-ebay-all" className={`${all.paid ? "btn-ebay" : "btn-ghost"} w-full`}>
            {all.cta}
          </OutboundLink>
          <p className="mt-0.5 text-right"><PaidTag paid={all.paid} /></p>
        </div>
      )}
      <div>
        <OutboundLink href={links.used.href} retailer={r.key} product={product} placement="product-ebay-used" className={`${links.used.paid ? "btn-ebay" : "btn-ghost"} w-full text-center`}>
          {links.used.label}
        </OutboundLink>
        <p className="mt-0.5 text-right"><PaidTag paid={links.used.paid} /></p>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        <li>
          <EbayText link={links.new} product={product} placement="product-ebay-new">{links.new.label}</EbayText>
        </li>
        <li>
          <EbayText link={links.sold} product={product} placement="product-ebay-sold">{links.sold.label}</EbayText>
          <p className="text-xs text-subtle">What it actually sold for lately: a good check on a used price.</p>
        </li>
      </ul>
    </aside>
  );
}
