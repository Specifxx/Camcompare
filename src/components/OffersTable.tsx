import { product as getProduct } from "@/lib/catalog";
import { MARKETS, type MarketCode } from "@/lib/markets";
import { AMAZON_MAX_AGE_H, type Offer } from "@/lib/offers";
import { alsoCheckLinks, ebayRows, offerRows, packKind } from "@/lib/offer-rows";
import { price } from "@/lib/format";
import EbayPanel from "./EbayPanel";
import { AlsoCheck, OfferRowItem } from "./OfferRows";
import TimedPrice from "./TimedPrice";

/**
 * Where to buy, in one market. Rows hold real prices only: every priced offer
 * except eBay's, in sortOffers order (in-stock body-only cheapest first); never
 * commission. eBay's live listings sit beside them (EbayPanel). Stores we may
 * not price yet (Amazon before its API, eBay before its keys) are tagged links
 * in an "Also check" box, never rows. An Amazon price, once its API gives one,
 * is a row with its time and Amazon's disclaimer, hidden after a day.
 */
export default function OffersTable({ product, query, offers, market, page, amazonAsin }: { product: string; query: string; offers: Offer[]; market: MarketCode; page: string; amazonAsin?: string }) {
  const p = getProduct(product);
  const pack = p ? packKind(p) : "lens";
  const rows = offerRows(offers, { page, placement: "offers", pack, withAmazon: true });
  const listings = ebayRows(offers, market, { page, placement: "ebay", pack });
  const checks = alsoCheckLinks({ product, query, offers, market, page, amazonAsin, placement: "check", amazonShown: rows.some((r) => r.amazon) });
  const side = listings.length > 0 || checks.length > 0;
  return (
    <div className={`grid grid-cols-1 items-start gap-4 ${side ? "lg:grid-cols-[minmax(0,1fr)_300px]" : ""}`}>
      <div>
        {rows.length ? (
          <>
            <ul className="card divide-y divide-line">
              {rows.map((r) => (
                <OfferRowItem key={r.id} row={r} product={product} placement="offers" priceNode={r.amazon && r.seenAt ? <TimedPrice text={price(r.price, r.currency)} seenAt={r.seenAt} maxAgeH={AMAZON_MAX_AGE_H} /> : undefined} />
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-subtle">Sorted by price, cheapest in-stock first. Some links earn us a commission; it never changes the order.</p>
            {rows.some((r) => r.amazon) && (
              <p className="mt-1 text-[11px] text-subtle">
                Amazon prices and availability are accurate as of the time shown and are subject to change. The price and availability shown on Amazon at the time of purchase will apply.
              </p>
            )}
          </>
        ) : (
          <div className="card p-5">
            <p className="font-semibold">No live prices in {MARKETS[market].name} yet</p>
            <p className="mt-1 text-sm text-muted">We list a price only when a retailer&apos;s own feed or API sends one, checked every day. None has for this product here yet.</p>
          </div>
        )}
      </div>
      {side && (
        <div className="flex flex-col gap-4">
          <EbayPanel product={product} query={query} offers={offers} market={market} page={page} />
          <AlsoCheck links={checks} product={product} placement="check" />
        </div>
      )}
    </div>
  );
}
