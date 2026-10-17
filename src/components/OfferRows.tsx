// The pieces of "where to buy" that the product page and the quick view
// share, so a row looks the same in both: a priced offer row, eBay's live
// listings, and the "Also check" box. Rows arrive built (lib/offer-rows.ts):
// sorted by price, links wrapped, `paid` decided. No server imports.
import { price } from "@/lib/format";
import type { CheckLink, OfferRow } from "@/lib/quickview";
import { retailer } from "@/lib/retailers";
import OutboundLink from "./OutboundLink";

/** Filled button for a link that earns (Amazon and eBay in their own colours), outlined for the rest. */
export function retailerButtonClass(key: string, paid: boolean): string {
  if (!paid) return "btn-ghost";
  const r = retailer(key);
  if (r?.amazon) return "btn-amazon";
  if (r?.ebay) return "btn-ebay";
  return "btn-buy";
}

const PaidNote = ({ paid }: { paid: boolean }) => (paid ? <p className="mt-0.5 text-[10px] leading-none text-subtle">Paid link</p> : null);

export function OfferRowItem({ row, product, placement, priceNode, dense = false }: { row: OfferRow; product: string; placement: string; priceNode?: React.ReactNode; dense?: boolean }) {
  const who = row.seller ? `Seller: ${row.seller}` : row.authorized ? "Authorized dealer" : null;
  const details = [who, row.variant ? `${row.variant} version` : null].filter(Boolean).join(" · ");
  return (
    <li className={`flex items-center gap-3 ${dense ? "px-3 py-2.5 sm:px-4" : "px-4 py-3"}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold leading-tight">{row.name}</p>
        <p className="mt-0.5 text-xs text-muted">
          {row.condition}
          {row.pack && <> · {row.pack}</>}
          {" · "}
          <span className={row.inStock ? "text-win" : "font-medium text-warn"}>{row.inStock ? "In stock" : "Out of stock"}</span>
        </p>
        {details && <p className="truncate text-xs text-subtle">{details}</p>}
      </div>
      <p className={`price shrink-0 text-right font-bold ${dense ? "text-[15px]" : "text-base"} ${row.inStock ? "" : "text-muted"}`}>{priceNode ?? price(row.price, row.currency)}</p>
      <div className={`${dense ? "w-[4.5rem]" : "w-24"} shrink-0 text-right`}>
        <OutboundLink href={row.href} retailer={row.retailer} product={product} placement={placement} className={`${retailerButtonClass(row.retailer, row.paid)} w-full ${dense ? "px-2" : ""}`}>
          View<span className="sr-only"> at {row.name}</span>
        </OutboundLink>
        <PaidNote paid={row.paid} />
      </div>
    </li>
  );
}

/** eBay's live listings: one seller each, so apart from the dealers' rows. */
export function EbayListings({ listings, product, placement }: { listings: OfferRow[]; product: string; placement: string }) {
  return (
    <ul className="flex flex-col gap-2">
      {listings.map((o) => (
        <li key={o.id}>
          <OutboundLink href={o.href} retailer={o.retailer} product={product} placement={placement} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm text-fg no-underline hover:border-accent hover:no-underline">
            <span className="min-w-0 truncate text-xs text-muted">
              {o.condition}
              {o.seller ? ` · ${o.seller}` : ""}
            </span>
            <span className="price shrink-0 font-bold">{price(o.price, o.currency)}</span>
          </OutboundLink>
        </li>
      ))}
    </ul>
  );
}

/**
 * Stores whose price we can't show yet (Amazon until its API opens, eBay
 * until its keys are set): a tagged link each, apart from the priced rows,
 * so a link never looks like a price.
 */
export function AlsoCheck({ links, product, placement, className = "" }: { links: CheckLink[]; product: string; placement: string; className?: string }) {
  if (!links.length) return null;
  return (
    <aside className={`card p-4 ${className}`} aria-label="Also check">
      <h3 className="text-sm font-bold">Also check</h3>
      <p className="mt-0.5 text-xs text-subtle">Their prices can&apos;t be listed here yet, so see them on their site.</p>
      <ul className="mt-3 flex flex-col gap-3">
        {links.map((l) => (
          <li key={l.retailer} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">{l.name}</p>
              <p className="text-xs text-subtle">{l.note}</p>
            </div>
            <div className="shrink-0 text-right">
              <OutboundLink href={l.href} retailer={l.retailer} product={product} placement={placement} className={`${retailerButtonClass(l.retailer, l.paid)} whitespace-nowrap`}>
                {l.cta}
              </OutboundLink>
              <PaidNote paid={l.paid} />
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
