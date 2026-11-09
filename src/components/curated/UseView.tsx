// /cameras-for/<use> (and /uk/cameras-for/<use>…): the camera finder's own rules (lib/finder.ts USES) as a static
// page per use, so a search for "best camera for vlogging" lands on real cameras with today's prices and the specs
// that earned each one its place (competitor scan, owner 2026-11-08: search-by-need hubs). No hidden weights, no paid
// placement: the order is the finder's score, then current models, then newest. Only cameras with a price in the
// market are listed; a page is indexed with USE_INDEX_MIN of them. DECISIONS.md 2026-11-08.
import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { publishedCameras } from "@/lib/catalog";
import { recommend, USES, type Use } from "@/lib/finder";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { pageMeta } from "@/lib/seo";
import { summarizeCamera } from "@/lib/summary";
import { USE_KEYS, USE_INDEX_MIN, picksForUse } from "@/lib/uses";

export { USE_KEYS, USE_INDEX_MIN, picksForUse };

export const isUse = (s: string): s is Use => s in USES;
const indexableForUse = (use: Use) => (x: MarketCode) => picksForUse(use, x).top.length >= USE_INDEX_MIN;

export function metadataForUse(use: Use, m: MarketCode): Metadata {
  const u = USES[use];
  const n = picksForUse(use, m).top.length;
  return pageMeta({
    title: `Best cameras for ${u.label.toLowerCase()}: ${n} picks with today's prices`,
    description: `${n} cameras for ${u.label.toLowerCase()} (${u.blurb.replace(/\.$/, "").toLowerCase()}), picked by the specs that matter, with today's new and used prices at the stores we track in ${MARKETS[m].name}.`,
    path: `/cameras-for/${use}`,
    market: m,
    index: n >= USE_INDEX_MIN,
    indexable: indexableForUse(use),
  });
}

export default function UseView({ use, market: m }: { use: Use; market: MarketCode }) {
  const u = USES[use];
  const { top, light } = picksForUse(use, m);
  const Grid = ({ list }: { list: ReturnType<typeof picksForUse>["top"] }) => (
    <ol className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {list.map(({ c, reasons }) => (
        <li key={c.slug} className="flex flex-col gap-2">
          <ProductCard p={c} market={m} />
          <ul className="flex flex-wrap gap-1 text-xs text-muted">
            {reasons.map((r) => (
              <li key={r} className="rounded-full border border-line px-2 py-0.5">
                ✓ {r}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-extrabold tracking-tight">Best cameras for {u.label.toLowerCase()}</h1>
        <p className="mt-2 text-sm text-muted">
          {u.blurb} These are the cameras that meet the most of what {u.label.toLowerCase()} needs, by the maker&apos;s spec sheet: every pick shows the specs that earned it a place.
          No paid placement. Prices are today&apos;s cheapest at the stores we track in {MARKETS[m].name}, new or used. Want a budget or a size?{" "}
          <Link href={marketPath(m, "/finder")} prefetch={false}>
            Try the camera finder
          </Link>
          .
        </p>
        <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Other uses">
          {USE_KEYS.filter((k) => k !== use).map((k) => (
            <Link key={k} href={marketPath(m, `/cameras-for/${k}`)} prefetch={false}>
              {USES[k].label}
            </Link>
          ))}
        </nav>
      </header>
      <section aria-labelledby="top-h">
        <h2 id="top-h" className="h-section">
          Top picks
        </h2>
        {top.length ? <Grid list={top} /> : <p className="mt-2 text-sm text-muted">No camera for this is priced in {MARKETS[m].name} today.</p>}
      </section>
      {light.length > 0 && (
        <section aria-labelledby="light-h">
          <h2 id="light-h" className="h-section">
            Smaller and lighter
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">Under 650 g, for when the camera has to come along every day.</p>
          <Grid list={light} />
        </section>
      )}
    </div>
  );
}
