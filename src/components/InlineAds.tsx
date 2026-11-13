"use client";

import Link from "next/link";
import OutboundLink from "./OutboundLink";
import type { RailTile, Rails } from "@/lib/side-rails";
import { useAdFeed } from "./useAdFeed";

// THE ad block: one, full column width, inside the page (owner, 2026-11-13: "replace the side ads with a bigger, subtler horizontal
// block that looks native"). Six larger tiles in a row, eBay first, then Amazon, scrolling sideways on a phone. Drawn like the site's
// own cards: same surface, border and text tokens, a small muted "Ad" label, nothing fixed or floating, no side space.
//
//   • Browser only: the tiles come from the static /rails/<market> file after hydration, never in the server HTML. The section's
//     height is reserved in CSS before they arrive (CLS 0); with nothing to show it folds away.
//   • Where (AdOrPromo, the ad positions): the home page between sections, a product page below its content, a list or deals page after
//     the grid. One per page. Never beside a buy button, above a price, or in the quick view. data-ad makes the phone dock yield.
//   • Links rel sponsored through OutboundLink, tagged cc-<market>-inline-ebay / cc-<market>-inline-amazon (lib/side-rails.ts), a buy_click
//     event each. Amazon tiles carry NO price (its licence) and are never in an overlay. Never a store, best price, deal or alert.

export const BLOCK_TILES = 6;
/** The Amazon tiles' share of the six when the market has Amazon. */
export const BLOCK_AMAZON = 2;

export interface BlockTile extends RailTile {
  source: "ebay" | "amazon";
}

/** The block's tiles: eBay's first, then Amazon's; the whole row is eBay where there is no Amazon. Pure. */
export function blockTiles(rails: Pick<Rails, "ebay" | "amazon">): BlockTile[] {
  const amazon = (rails.amazon?.tiles ?? []).slice(0, BLOCK_AMAZON);
  const ebay = rails.ebay.tiles.slice(0, BLOCK_TILES - amazon.length);
  return [...ebay.map((t) => ({ ...t, source: "ebay" as const })), ...amazon.map((t) => ({ ...t, source: "amazon" as const }))];
}

const TILE = "group flex h-full flex-col rounded-lg border border-line bg-surface p-3 no-underline transition-colors hover:border-subtle hover:no-underline";

export default function InlineAds() {
  const rails = useAdFeed(true);
  if (rails === null) return null;
  const tiles = rails ? blockTiles(rails) : [];
  if (rails && tiles.length < 2) return null;
  const labels = rails ? [rails.ebay.label, rails.amazon?.label].filter(Boolean).join(" and ") : "";
  return (
    // The reserved height: header, one tile and the note, before the tiles arrive.
    <section data-ad={rails ? "inline" : undefined} aria-label="Sponsored" aria-hidden={rails ? undefined : true} className="my-8 min-h-[384px]">
      {rails && (
        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-muted">More to look at on {labels}</h2>
            <span className="rounded bg-raised px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-muted">Ad</span>
          </div>
          <ul role="list" className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1 sm:-mx-5 sm:px-5 [scrollbar-width:thin] md:overflow-visible">
            {tiles.map((t) => {
              const label = t.source === "ebay" ? rails.ebay.label : (rails.amazon?.label ?? "Amazon");
              return (
                <li key={`${t.source}-${t.id}`} className="w-[168px] shrink-0 snap-start md:w-0 md:flex-1">
                  <OutboundLink href={t.href} retailer={label} product={t.id} placement={`inline-${t.source}`} className={TILE}>
                    <span className="relative block h-36 w-full overflow-hidden rounded-md bg-white">
                      <img src={t.img} alt={`${t.name} on ${label}`} width={144} height={144} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-contain p-2" />
                    </span>
                    <span className="mt-2 line-clamp-2 h-10 text-sm font-semibold leading-5 text-fg group-hover:text-accent">{t.name}</span>
                    <span className="mt-1 flex h-6 items-baseline justify-between gap-2">
                      {t.price ? (
                        <span className="truncate text-base font-bold tabular-nums text-fg">
                          {t.price}
                          {t.note && <span className="ml-1 text-[11px] font-semibold text-muted">{t.note}</span>}
                        </span>
                      ) : (
                        <span className="truncate text-xs font-semibold text-accent">See price ↗</span>
                      )}
                      <span className="shrink-0 text-[11px] text-subtle">{t.source === "ebay" ? "eBay" : "Amazon"}</span>
                    </span>
                  </OutboundLink>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] text-subtle">
            Paid links: we may earn a commission if you buy through them. They never change our rankings or our best price.{" "}
            <Link href="/disclosure" prefetch={false} className="underline">
              How we make money
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}
