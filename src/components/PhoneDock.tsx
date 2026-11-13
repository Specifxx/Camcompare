"use client";

import OutboundLink from "./OutboundLink";
import { AdDock, DockGate, DockTile, DOCK_LINK } from "./AdDock";
import { useAdFeed } from "./useAdFeed";

// The phone dock (AdDock.tsx): the eBay tiles in a slim bar along the foot of a screen narrower than MIN_WIDTH, after a scroll,
// never on a product page, yielding to the in-page ad block (data-ad). eBay only: Amazon never goes in an overlay (Associates' rule).
// Browser only: nothing is in the server HTML. (The side rails it once shared a file with are gone: owner, 2026-11-13.)

export const MIN_WIDTH = 1280;

/** The eBay tag with the dock's placement in it (inline-ebay → dock-ebay), so EPN's customid report tells the two apart. Pure. */
export function dockHref(href: string): string {
  return href.replace(/(customid=cc-[a-z]+-)inline-ebay/, "$1dock-ebay");
}

export function PhoneDock() {
  return (
    <DockGate minWidth={MIN_WIDTH}>
      <DockItems />
    </DockGate>
  );
}

function DockItems() {
  const rails = useAdFeed(true);
  if (!rails) return null;
  const items = rails.ebay.tiles
    .filter((t) => t.price)
    .map((t) => (
      <OutboundLink key={t.id} href={dockHref(t.href)} retailer={rails.ebay.label} product={t.id} placement="dock-ebay" className={DOCK_LINK}>
        <DockTile img={t.img} alt={`${t.name} on eBay`} brand={<span className="font-bold text-fg">eBay</span>} title={t.name} price={t.note ? `${t.price} · ${t.note}` : t.price!} cta="View" />
        <span className="sr-only">, on {rails.ebay.label}</span>
      </OutboundLink>
    ));
  if (items.length === 0) return null;
  return <AdDock label={`Sponsored: on ${rails.ebay.label}`} items={items} placement="dock-ebay" minWidth={MIN_WIDTH} yieldTo="[data-ad], [data-dock-yield]" />;
}
