import { affiliateUrl, isPaid, subId } from "@/lib/affiliate";
import { asinFor } from "@/lib/amazon-asins";
import { price } from "@/lib/format";
import { MARKETS, type MarketCode } from "@/lib/markets";
import { AMAZON_MAX_AGE_H, type Offer } from "@/lib/offers";
import { CONDITION_LABEL, retailer, retailersFor, type Retailer } from "@/lib/retailers";
import OutboundLink from "./OutboundLink";
import TimedPrice from "./TimedPrice";

const MOUNT_SHORT: Record<string, string> = {
  "sony-e": "Sony E", "canon-rf": "Canon RF", "canon-ef": "Canon EF", "canon-ef-m": "Canon EF-M", "nikon-z": "Nikon Z", "nikon-f": "Nikon F",
  "fujifilm-x": "Fujifilm X", "fujifilm-g": "Fujifilm G", "l-mount": "L-Mount", "micro-four-thirds": "MFT", "pentax-k": "Pentax K", "leica-m": "Leica M",
};

/** Filled button for links that earn (Amazon in its own colours), outline for the rest. */
export function buttonClass(r: Retailer | undefined, href?: string): string {
  if (!r || !isPaid(r.key, href)) return "btn-ghost";
  if (r.amazon) return "btn-amazon";
  if (r.ebay) return "btn-ebay";
  return "btn-buy";
}

/**
 * Where to buy, in one market:
 *  1. every priced offer except eBay's (eBay has its own panel), cheapest first;
 *  2. a "Check price" row for each main retailer that has no price here yet:
 *     Amazon always (its prices may only be shown from its API, which opens
 *     after the account's first sales), then the market's main dealers.
 * The order is price, then the check rows; never commission. Rows whose link
 * earns get a filled button and a "Paid link" note. An Amazon price carries
 * its time and Amazon's disclaimer, and hides itself once over a day old.
 */
export default function OffersTable({ product, query, offers, market, page, amazonAsin }: { product: string; query: string; offers: Offer[]; market: MarketCode; page: string; amazonAsin?: string }) {
  const priced = offers.filter((o) => !retailer(o.retailer)?.ebay);
  const have = new Set(priced.map((o) => o.retailer));
  const checks = retailersFor(market).filter((r) => r.checkRow && r.searchUrl && !r.ebay && !have.has(r.key));
  const checkHref = (r: Retailer) => {
    const asin = r.amazon ? asinFor(product, r.amazon.marketplace, amazonAsin) : null;
    return affiliateUrl(r.key, asin ? `https://${r.amazon!.marketplace}/dp/${asin}` : r.searchUrl!(query), subId(page, "check"));
  };
  if (!priced.length && !checks.length) {
    return <p className="card p-4 text-sm text-muted">No {MARKETS[market].short} retailers carry this yet.</p>;
  }
  const amazonPriced = priced.some((o) => retailer(o.retailer)?.amazon);
  return (
    <div>
      <ul className="card divide-y divide-line">
        {priced.map((o, i) => {
          const r = retailer(o.retailer);
          // A feed or eBay link may already carry the affiliate id the import ran with.
          const href = affiliateUrl(o.retailer, o.url, subId(page, "offers"));
          const paid = isPaid(o.retailer, href);
          return (
            <li key={`${o.retailer}-${o.sourceId ?? i}`} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {r?.name ?? o.retailer}
                  <span className="ml-2 text-xs font-normal text-muted">{CONDITION_LABEL[o.condition]}</span>
                  {!o.inStock && <span className="ml-1 text-xs text-warn">out of stock</span>}
                </p>
                <p className="truncate text-xs text-subtle">
                  {[o.seller ? `Seller: ${o.seller}` : r?.authorized ? "Authorized dealer" : null, o.mount && MOUNT_SHORT[o.mount] ? `${MOUNT_SHORT[o.mount]} version` : null, o.kit ? "includes lens" : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              <p className="price shrink-0 text-base font-bold">
                {r?.amazon ? <TimedPrice text={price(o.price, o.currency)} seenAt={o.seenAt} maxAgeH={AMAZON_MAX_AGE_H} /> : price(o.price, o.currency)}
              </p>
              <div className="w-24 shrink-0 text-right">
                <OutboundLink href={href} retailer={o.retailer} product={product} placement="offers" className={`${buttonClass(r, href)} w-full`}>
                  View
                </OutboundLink>
                {paid && <p className="mt-0.5 text-[10px] text-subtle">Paid link</p>}
              </div>
            </li>
          );
        })}
        {checks.map((r) => (
          <li key={r.key} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{r.name}</p>
              <p className="text-xs text-subtle">{r.amazon ? "Price shown on Amazon" : r.conditions.includes("used") && r.conditions.length === 1 ? "Used stock, graded and warrantied" : "Check today's price"}</p>
            </div>
            <div className="shrink-0 text-right">
              <OutboundLink href={checkHref(r)} retailer={r.key} product={product} placement="check" className={buttonClass(r, checkHref(r))}>
                {r.amazon ? "Check price on Amazon" : "Check price"}
              </OutboundLink>
              {isPaid(r.key, checkHref(r)) && <p className="mt-0.5 text-[10px] text-subtle">Paid link</p>}
            </div>
          </li>
        ))}
      </ul>
      {amazonPriced && (
        <p className="mt-2 text-[11px] text-subtle">
          Amazon prices and availability are accurate as of the time shown and are subject to change. The price and availability shown on Amazon at the time of purchase will apply.
        </p>
      )}
    </div>
  );
}
