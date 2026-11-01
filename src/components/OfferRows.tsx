// The pieces of "where to buy" that the product page and the quick view
// share, so a row looks the same in both: a priced offer row, eBay's live
// listings, and the "Also check" box. Rows arrive built (lib/offer-rows.ts):
// sorted by price, links wrapped, `paid` decided. No server imports.
import { price } from "@/lib/format";
import type { CheckLink, OfferRow } from "@/lib/quickview";
import { retailer } from "@/lib/retailers";
import { rowWarning } from "@/lib/rrp";
import OutboundLink from "./OutboundLink";
import AccessoryThumb from "./AccessoryThumb";

/** Filled button for a link that earns, outlined for the rest. Amazon and eBay
 *  wear the same button as every store (owner, 2026-11-01: "blend in"). */
export function retailerButtonClass(_key: string, paid: boolean): string {
  return paid ? "btn-buy" : "btn-ghost";
}

const PaidNote = ({ paid }: { paid: boolean }) => (paid ? <p className="mt-0.5 text-[10px] leading-none text-subtle">Paid link</p> : null);

const AVAIL: Record<NonNullable<OfferRow["avail"]>, { text: string; cls: string }> = {
  low_stock: { text: "Low stock", cls: "text-warn" },
  preorder: { text: "Preorder", cls: "text-accent" },
  backorder: { text: "Backorder", cls: "text-warn" },
};

/** "In stock" (green), "Low stock" / "Backorder" (amber), "Preorder" (blue), "Out of stock" (grey). */
export function Availability({ row }: { row: Pick<OfferRow, "inStock" | "avail"> }) {
  const a = row.inStock ? (row.avail ? AVAIL[row.avail] : { text: "In stock", cls: "text-win" }) : { text: "Out of stock", cls: "text-subtle" };
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${a.cls}`}>
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {a.text}
    </span>
  );
}

const TAG: Record<NonNullable<OfferRow["tag"]>, string> = { best: "Best price", used: "Lowest used", kit: "Lowest kit price" };

/** "N% off" from the store's own was-price, only when it is above today's price. Client-safe twin of percentOff. */
export const pctOff = (p: number, was?: number) => (was && was > p ? Math.floor(((was - p) / was) * 100) : 0);

/**
 * One offer. `rrp` (this market's launch RRP) and `usedTypical` (the typical
 * used price), both in minor units, add a warning badge to a row priced above
 * them. The badge flags the price, never the seller. `className` carries the
 * tab filter classes (OffersTable).
 */
export function OfferRowItem({ row, product, placement, priceNode, dense = false, rrp, usedTypical, className = "" }: { row: OfferRow; product: string; placement: string; priceNode?: React.ReactNode; dense?: boolean; rrp?: number | null; usedTypical?: number | null; className?: string }) {
  const warn = rowWarning(row, rrp, usedTypical);
  const who = row.seller ? `Seller: ${row.seller}` : row.authorized ? "Authorized dealer" : null;
  const details = [row.detail, who, row.variant ? `${row.variant} version` : null].filter(Boolean).join(" · ");
  const off = pctOff(row.price, row.was);
  return (
    <li className={`flex items-center gap-3 ${dense ? "px-3 py-2.5 sm:px-4" : "px-3 py-3 sm:px-4"} ${row.tag === "best" ? "bg-buy-soft/40" : ""} ${className}`}>
      {row.image && <AccessoryThumb src={row.image} alt={`${row.condition} listing at ${row.name}`} group="camera" store={row.name} size="sm" />}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-tight">
          <span className="font-semibold">{row.name}</span>
          {row.tag && <span className={`rounded px-1.5 py-px text-[11px] font-semibold ${row.tag === "best" ? "bg-buy text-buy-fg" : "bg-buy-soft text-win"}`}>{TAG[row.tag]}</span>}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
          <span>{row.condition}</span>
          {row.pack && !row.kit && <span>· {row.pack}</span>}
          <span aria-hidden>·</span>
          <Availability row={row} />
          {row.count && row.count > 1 ? <span className="text-subtle">· ×{row.count} listings</span> : null}
        </p>
        {row.kit && row.pack && <p className="mt-0.5 text-xs font-medium text-fg">{row.pack}</p>}
        {details && <p className="text-xs text-subtle">{details}</p>}
        {(row.promo || warn) && (
          <p className="mt-1 flex flex-wrap gap-1">
            {row.promo && (
              <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-accent/30 bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-fg" title={row.promo}>
                <span aria-hidden className="text-accent">+</span>
                {row.promo}
              </span>
            )}
            {warn && (
              <span className="inline-flex items-center gap-1 rounded-full border border-warn/50 bg-warn/10 px-2 py-0.5 text-[11px] font-semibold text-warn" title={warn.kind === "rrp" ? "Priced above the maker's launch RRP in this market" : "Priced above the typical used asking price we've recorded"}>
                <span aria-hidden>▲</span>
                {warn.text}
              </span>
            )}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className={`price font-bold ${dense ? "text-[15px]" : "text-base"} ${row.inStock ? "" : "text-muted"}`}>{priceNode ?? price(row.price, row.currency)}</p>
        {off > 0 && row.was && (
          <p className="text-[11px] leading-tight">
            <span className="rounded bg-buy-soft px-1 font-semibold text-win">{off}% off</span> <s className="price text-subtle">{price(row.was, row.currency)}</s>
          </p>
        )}
      </div>
      <div className={`${dense ? "w-[4.5rem]" : "w-20 sm:w-24"} shrink-0 text-right`}>
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
              {o.tag && <span className="ml-1 rounded bg-buy-soft px-1 text-[10px] font-semibold text-win">{TAG[o.tag]}</span>}
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

/** A pinned Amazon or eBay row: a link, with a price only when we have a live one. */
export type PinnedLink = { retailer: string; name: string; href: string; paid: boolean; note: string; cta: string; price?: React.ReactNode };

/**
 * Amazon and eBay, pinned above the price-sorted rows on the product page and
 * in the quick view (owner, 2026-10-30: "the very, very top", always shown).
 * Drawn exactly like an offer row, no tint and the stores' own button (owner,
 * 2026-11-01: "blend in and look exactly the same as the other price rows"),
 * labelled "Ad". Never part of the sort, never "Best price".
 */
export function PinnedMarkets({ links, product, placement, dense = false, className = "" }: { links: PinnedLink[]; product: string; placement: string; dense?: boolean; className?: string }) {
  if (!links.length) return null;
  return (
    <ul className={`card divide-y divide-line overflow-hidden ${className}`} aria-label="Amazon and eBay">
      {links.map((l) => {
        const kind = retailer(l.retailer)?.amazon ? "amazon" : "ebay";
        return (
          <li key={l.retailer} className={`flex items-center gap-3 ${dense ? "px-3 py-2.5 sm:px-4" : "px-3 py-3 sm:px-4"}`}>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-tight">
                <span className="font-semibold">{l.name}</span>
                <span className="rounded bg-buy-soft px-1.5 py-px text-[11px] font-semibold text-win">Ad</span>
              </p>
              <p className="mt-0.5 text-xs text-muted">{l.note}</p>
            </div>
            {l.price && <div className={`price shrink-0 text-right font-bold ${dense ? "text-[15px]" : "text-base"}`}>{l.price}</div>}
            <div className={`${l.price ? (dense ? "w-[4.5rem]" : "w-20 sm:w-24") : ""} shrink-0 text-right`}>
              <OutboundLink href={l.href} retailer={l.retailer} product={product} placement={`${placement}-${kind}`} className={`btn-buy ${l.price ? "w-full" : "whitespace-nowrap"} ${dense ? "px-2" : ""}`}>
                {l.cta}
                <span className="sr-only"> at {l.name}</span>
              </OutboundLink>
              <PaidNote paid={l.paid} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** eBay's pinned row: today's cheapest live listing when there is one, else the tagged search. */
export function ebayPin(name: string, listing: OfferRow | undefined, search: CheckLink | null): PinnedLink | null {
  if (listing) {
    const who = [listing.condition, listing.seller].filter(Boolean).join(" · ");
    return { retailer: listing.retailer, name, href: listing.href, paid: listing.paid, note: `Cheapest live listing today${who ? `: ${who}` : ""}`, cta: "View", price: price(listing.price, listing.currency) };
  }
  return search ? { retailer: search.retailer, name, href: search.href, paid: search.paid, note: "New and used, from single sellers: check condition and returns", cta: "Search eBay" } : null;
}
