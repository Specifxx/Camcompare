import type { Camera } from "@/lib/catalog/schema";
import { affiliateUrl, isPaid, subId } from "@/lib/affiliate";
import { centsToUsd } from "@/lib/format";
import type { Offer } from "@/lib/offers";
import { CONDITION_LABEL, RETAILERS, retailer } from "@/lib/retailers";
import OutboundLink from "./OutboundLink";

const searchQuery = (c: Camera) => `${c.name} body`.replace(/α/g, "a");

/**
 * Today's offers, cheapest first. With none yet, the retailers' own search
 * pages — still useful, and honest about having no price to show.
 */
export default function OffersTable({ camera, offers, page }: { camera: Camera; offers: Offer[]; page: string }) {
  if (!offers.length) {
    const links = RETAILERS.filter((r) => r.searchUrl);
    return (
      <div className="card p-4">
        <p className="text-sm text-muted">
          We haven&apos;t collected live prices for the {camera.shortName} yet. Check it at these retailers:
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {links.map((r) => (
            <OutboundLink
              key={r.key}
              href={affiliateUrl(r.key, r.searchUrl!(searchQuery(camera)), subId(page, "search"))}
              retailer={r.key}
              camera={camera.slug}
              placement="search"
              className="btn-ghost"
            >
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
                {o.seller ? `Seller: ${o.seller}` : r?.authorized ? "Authorized US dealer" : ""}
                {o.kit ? " · includes lens" : ""}
              </p>
            </div>
            <p className="price shrink-0 text-base font-bold">{centsToUsd(o.priceCents)}</p>
            <div className="shrink-0 text-right">
              <OutboundLink href={affiliateUrl(o.retailer, o.url, subId(page, "offers"))} retailer={o.retailer} camera={camera.slug} placement="offers" className="btn-buy">
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
