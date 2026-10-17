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
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-subtle">
            <th className="px-4 py-2 font-medium">Retailer</th>
            <th className="px-4 py-2 font-medium">Condition</th>
            <th className="px-4 py-2 text-right font-medium">Price</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {offers.map((o, i) => {
            const r = retailer(o.retailer);
            const paid = isPaid(o.retailer);
            return (
              <tr key={`${o.retailer}-${o.sourceId ?? i}`} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <p className="font-semibold">{r?.name ?? o.retailer}</p>
                  <p className="text-xs text-subtle">
                    {o.seller ? `Seller: ${o.seller}` : r?.authorized ? "Authorized US dealer" : ""}
                    {o.kit ? " · includes lens" : ""}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {CONDITION_LABEL[o.condition]}
                  {!o.inStock && <span className="ml-1 text-xs text-warn">out of stock</span>}
                </td>
                <td className="price px-4 py-3 text-right text-base font-bold">{centsToUsd(o.priceCents)}</td>
                <td className="px-4 py-3 text-right">
                  <OutboundLink href={affiliateUrl(o.retailer, o.url, subId(page, "offers"))} retailer={o.retailer} camera={camera.slug} placement="offers" className="btn-buy">
                    View
                  </OutboundLink>
                  {paid && <p className="mt-1 text-[10px] text-subtle">Paid link</p>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
