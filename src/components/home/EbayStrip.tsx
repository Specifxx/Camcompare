// The home page's one eBay block: "Shop used cameras on eBay", a compact
// strip of tagged category searches (placement "home-ebay") in this
// market's eBay site. Nothing in Singapore (no EPN programme there).
import { ebayCategoryLinks } from "@/lib/ebay-links";
import type { MarketCode } from "@/lib/markets";
import OutboundLink from "../OutboundLink";
import { PaidTag } from "../ebay/EbayText";

export default function EbayStrip({ market: m }: { market: MarketCode }) {
  const links = ebayCategoryLinks(m, `home-${m}`, "home-ebay");
  if (!links.length) return null;
  return (
    <section aria-labelledby="ebay-title" className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="shrink-0">
        <h2 id="ebay-title" className="font-semibold">Shop used cameras on {links[0].name}</h2>
        <p className="text-xs text-subtle">
          Single sellers and auctions, outside our price lists. <PaidTag paid={links.some((l) => l.paid)} />
        </p>
      </div>
      <ul className="flex flex-wrap gap-2 sm:ml-auto">
        {links.map((l) => (
          <li key={l.href}>
            <OutboundLink href={l.href} retailer={l.retailer} product={`home-${m}`} placement="home-ebay" className="chip-link px-3 py-1 text-sm">
              {l.label}
            </OutboundLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
