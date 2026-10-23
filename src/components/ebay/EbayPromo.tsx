// "Shop on eBay": a native box of a few tagged eBay searches, in an ad
// position while no AdSense slot is configured (AdOrPromo). No third-party
// script: EPN no longer reliably offers banners to new publishers, and our
// own links are lighter, match the site and carry a customid per placement.
// Labelled as paid. The ad rules stand: never beside a buy button, never
// above a product's price, no interstitials. Nothing in Singapore.
import type { EbayLink } from "@/lib/ebay-links";
import OutboundLink from "../OutboundLink";

export default function EbayPromo({ title = "Shop on eBay", note, links, product, placement }: { title?: string; note?: string; links: EbayLink[]; product: string; placement: string }) {
  if (!links.length) return null;
  return (
    <aside aria-label="Shop on eBay" className="card my-8 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-[10px] uppercase tracking-wide text-subtle">{links.some((l) => l.paid) ? "Paid link · eBay Partner Network" : "eBay"}</p>
      </div>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((l) => (
          <li key={l.href}>
            <OutboundLink href={l.href} retailer={l.retailer} product={product} placement={placement} className="flex h-full items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2.5 text-sm font-semibold text-fg no-underline hover:border-accent hover:no-underline">
              <span>{l.label}</span>
              <span aria-hidden className="text-accent">↗</span>
            </OutboundLink>
          </li>
        ))}
      </ul>
    </aside>
  );
}
