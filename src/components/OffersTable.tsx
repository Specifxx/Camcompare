import { affiliateUrl, isPaid, subId } from "@/lib/affiliate";
import { price } from "@/lib/format";
import { MARKETS, type MarketCode } from "@/lib/markets";
import type { Offer } from "@/lib/offers";
import { CONDITION_LABEL, retailer, retailersFor } from "@/lib/retailers";
import OutboundLink from "./OutboundLink";

const MOUNT_SHORT: Record<string, string> = {
  "sony-e": "Sony E", "canon-rf": "Canon RF", "canon-ef": "Canon EF", "canon-ef-m": "Canon EF-M", "nikon-z": "Nikon Z", "nikon-f": "Nikon F",
  "fujifilm-x": "Fujifilm X", "fujifilm-g": "Fujifilm G", "l-mount": "L-Mount", "micro-four-thirds": "MFT", "pentax-k": "Pentax K", "leica-m": "Leica M",
};

/**
 * Today's offers in one market, cheapest first. With none yet, the market's
 * retailers' own search pages — still useful, and honest about having no price.
 */
export default function OffersTable({ product, query, offers, market, page }: { product: string; query: string; offers: Offer[]; market: MarketCode; page: string }) {
  if (!offers.length) {
    const links = retailersFor(market).filter((r) => r.searchUrl);
    return (
      <div className="card p-4">
        <p className="text-sm text-muted">No live {MARKETS[market].short} prices yet. Check these retailers:</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {links.map((r) => (
            <OutboundLink key={r.key} href={affiliateUrl(r.key, r.searchUrl!(query), subId(page, "search"))} retailer={r.key} product={product} placement="search" className="btn-ghost">
              {r.name}
              {isPaid(r.key) && <span className="text-[10px] font-normal text-subtle">· paid link</span>}
            </OutboundLink>
          ))}
        </div>
      </div>
    );
  }
  // A list, not a table: on a phone the price and the button must stay on
  // screen without sideways scrolling.
  return (
    <ul className="card divide-y divide-line">
      {offers.map((o, i) => {
        const r = retailer(o.retailer);
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
            <p className="price shrink-0 text-base font-bold">{price(o.price, o.currency)}</p>
            <div className="shrink-0 text-right">
              <OutboundLink href={affiliateUrl(o.retailer, o.url, subId(page, "offers"))} retailer={o.retailer} product={product} placement="offers" className="btn-buy">
                View
              </OutboundLink>
              {isPaid(o.retailer) && <p className="mt-0.5 text-[10px] text-subtle">Paid link</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
