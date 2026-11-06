"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useMarket } from "@/lib/market-client";
import OutboundLink from "./OutboundLink";
import { AdDock, DockGate, DockTile, DOCK_LINK } from "./AdDock";
import type { RailTile, Rails } from "@/lib/side-rails";

// The two side rails (ported from DexCompare / MTG Compare / WargameCompare / RiftCompare; owner 2026-11-06: "the eBay ads … but
// instead of the TCGplayer ad, the Amazon ad banner that's scrollable"): eBay down the far left of a wide screen, Amazon down the
// far right, OUTSIDE the page's column, each up to ten products that scroll inside the rail.
//
//   • From MIN_WIDTH (1280px: every regular 16:9 and 16:10 screen, the sisters' rule). Below 1472px the page's column gives up
//     160px a side for them (globals.css: <main> and the footer's rows); from 1472px it is its full 72rem and the rails sit
//     just outside it. Pure CSS, the same on the server: nothing moves when the rails mount (CLS 0).
//   • Browser only: the tiles come from the static /rails/<region> after hydration, never in the server HTML (no SEO change).
//   • Fixed under the header, clear of the feedback button. Labelled "Ad"; links rel sponsored, tagged cc-<market>-side-ebay /
//     cc-<market>-side-amazon, clicks a buy_click event like every retailer link. Amazon tiles carry no price (lib/side-rails.ts says why). Not a pop-up: nothing moves or covers content.
//   • Below MIN_WIDTH the eBay tiles go to the phone dock (AdDock.tsx); Amazon never does (an overlay).

export const MIN_WIDTH = 1280;
const SHELL_W = 1152;
export const RAIL_W = 136;
const GUTTER = 12;
/** Room at the foot for the feedback button (bottom-left, FeedbackWidget.tsx). */
const FOOT = 64;
const RAIL_EDGE = `max(${GUTTER}px, calc(50% - ${SHELL_W / 2 + GUTTER + RAIL_W}px))`;
/** One whole tile must fit between the header and the foot, or no rail. */
export const MIN_HEIGHT = 560;

const loaded = new Map<string, Promise<Rails | null>>();
function load(region: string): Promise<Rails | null> {
  let p = loaded.get(region);
  if (!p) {
    p = fetch(`/rails/${region}`)
      .then((r) => (r.ok ? (r.json() as Promise<Rails>) : null))
      .catch(() => null);
    loaded.set(region, p);
  }
  return p;
}

function useRails(enabled: boolean): Rails | null {
  const region = useMarket(usePathname() ?? "/");
  const [rails, setRails] = useState<Rails | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    load(region).then((r) => live && setRails(r));
    return () => {
      live = false;
    };
  }, [region, enabled]);
  return enabled && rails?.market === region ? rails : null;
}

/** The rails, mounted once in the root layout. */
export function SideRails() {
  const [fit, setFit] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [top, setTop] = useState(120);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MIN_WIDTH}px)`);
    const update = () => {
      setFit(mq.matches && window.innerHeight >= MIN_HEIGHT);
      setNarrow(!mq.matches);
      // Under the sticky header (two rows on wide screens): its bottom edge.
      const h = document.querySelector("header");
      if (h) setTop(Math.max(0, Math.round(h.getBoundingClientRect().bottom)) + GUTTER);
    };
    update();
    mq.addEventListener("change", update);
    window.addEventListener("resize", update, { passive: true });
    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  const rails = useRails(fit);
  if (narrow) return <RailDock />;
  if (!fit || !rails) return null;
  return (
    <>
      {rails.ebay.tiles.length >= 2 && (
        <Rail side="left" top={top} heading="On eBay" label={rails.ebay.label} tiles={rails.ebay.tiles} placement="side-ebay" more={null} note="Affiliate links" />
      )}
      {rails.amazon && rails.amazon.tiles.length >= 2 && (
        <Rail side="right" top={top} heading="On Amazon" label={rails.amazon.label} tiles={rails.amazon.tiles} placement="side-amazon" more={null} note="Paid links" />
      )}
    </>
  );
}

const TILE = "group flex flex-col rounded-xl border border-line bg-surface p-2 transition-colors hover:border-accent/50";

function Rail({ side, top, heading, label, tiles, placement, more, note }: { side: "left" | "right"; top: number; heading: string; label: string; tiles: RailTile[]; placement: string; more: string | null; note: string }) {
  return (
    <div
      role="group"
      data-ad={placement}
      aria-label={`Sponsored: ${label}`}
      className="fixed z-30 flex flex-col rounded-2xl border border-line bg-surface p-2 shadow-card"
      style={{ top, bottom: FOOT, width: RAIL_W, ...(side === "left" ? { left: RAIL_EDGE } : { right: RAIL_EDGE }) }}
    >
      <div className="mb-2 flex h-[22px] shrink-0 items-center justify-between px-1">
        <span className="truncate text-[13px] font-bold tracking-tight">{heading}</span>
        <span className="rounded bg-raised px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-muted">Ad</span>
      </div>
      <ul role="list" className="rail-scroll grid min-h-0 flex-1 content-start gap-2 overflow-y-auto overscroll-contain">
        {tiles.map((t) => (
          <li key={t.id}>
            <OutboundLink href={t.href} retailer={label} product={t.id} placement={placement} className={TILE}>
              <span className="relative block aspect-square w-full overflow-hidden rounded-lg bg-white">
                <img src={t.img} alt={`${t.name} on ${label}`} width={120} height={120} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-contain p-1" />
              </span>
              <span className="mt-1.5 line-clamp-2 h-9 text-xs font-semibold leading-[18px] group-hover:text-accent">{t.name}</span>
              {t.price ? (
                <span className="block h-5 truncate text-[15px] font-bold tabular-nums leading-5">
                  {t.price}
                  {t.note && <span className="ml-1 text-[11px] font-semibold text-muted">{t.note}</span>}
                </span>
              ) : (
                <span className="block h-5 truncate text-xs font-semibold leading-5 text-accent">See price ↗</span>
              )}
              <span className="sr-only">, on {label}</span>
            </OutboundLink>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex shrink-0 flex-col px-1 text-[10px] leading-[13px] text-muted">
        {more && (
          <OutboundLink href={more} retailer={label} product="" placement={placement} className="truncate font-bold text-accent">
            More on {label} →
          </OutboundLink>
        )}
        <span className="truncate">{note}</span>
      </p>
    </div>
  );
}

/** The eBay tag with the dock's placement in it (side-ebay → dock-ebay), so EPN's customid report tells the two apart. Pure. */
export function dockHref(href: string): string {
  return href.replace(/(customid=cc-[a-z]+-)side-ebay/, "$1dock-ebay");
}

function RailDock() {
  return (
    <DockGate minWidth={MIN_WIDTH}>
      <DockItems />
    </DockGate>
  );
}

function DockItems() {
  const rails = useRails(true);
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
