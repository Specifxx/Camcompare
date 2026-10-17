import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import ProductThumb from "@/components/ProductThumb";
import { brands, displayShortName, historyAll, indexedPairs, mounts, pairSlug, product, publishedCameras, publishedLenses, type AnyProduct } from "@/lib/catalog";
import { price } from "@/lib/format";
import { priceDrops } from "@/lib/insights";
import { MARKET_CODES, MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { pageMeta } from "@/lib/seo";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { summarizeCamera, summarizeLens } from "@/lib/summary";

export function homeMetadata(m: MarketCode): Metadata {
  return pageMeta({
    title: `${SITE_NAME}: ${SITE_TAGLINE}`,
    description: `Compare camera and lens specs side by side and find the lowest new and used price at retailers in ${MARKETS[m].name}.`,
    path: "/",
    market: m,
  });
}

const newestOf = ([a, b]: [AnyProduct, AnyProduct]) => (a.item.announced > b.item.announced ? a.item.announced : b.item.announced);

export default function HomeView({ market: m }: { market: MarketCode }) {
  const cameras = publishedCameras();
  const lenses = publishedLenses();
  const pairs = indexedPairs("camera").sort((p, q) => newestOf(q).localeCompare(newestOf(p))).slice(0, 9);
  const drops = priceDrops(historyAll(m), "new").slice(0, 4);
  const live = brands().filter((b) => cameras.some((c) => c.brand === b.slug) || lenses.some((l) => l.brand === b.slug));
  const systems = mounts().filter((mt) => mt.status === "current" && cameras.some((c) => c.mount === mt.slug));
  return (
    <div className="flex flex-col gap-12">
      <section className="pt-4">
        <p className="text-sm font-semibold text-accent">{MARKETS[m].flag} Prices for {MARKETS[m].name}</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">Find the right camera or lens, then the lowest price for it, new or used.</h1>
        <p className="mt-3 max-w-2xl text-muted">
          {cameras.length} cameras{lenses.length ? ` and ${lenses.length} lenses` : ""} from {live.length} makers, spec sheets side by side, with new, used and refurbished prices from retailers in {MARKET_CODES.length} markets.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={marketPath(m, "/cameras")} className="btn-primary">Browse cameras</Link>
          <Link href={marketPath(m, "/lenses")} className="btn-ghost">Browse lenses</Link>
          <Link href={marketPath(m, "/finder")} className="btn-ghost">Help me choose</Link>
          <Link href={marketPath(m, "/deals")} className="btn-ghost">Price drops</Link>
        </div>
      </section>

      {drops.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="h-section">Biggest price drops this week</h2>
            <Link href={marketPath(m, "/deals")} className="text-sm">All deals →</Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {drops.map((d) => {
              const p = product(d.slug)!;
              return (
                <li key={d.slug}>
                  <Link href={marketPath(m, `/${p.kind === "camera" ? "cameras" : "lenses"}/${d.slug}`)} className="card flex items-center gap-3 p-3 text-fg no-underline hover:border-accent hover:no-underline">
                    <ProductThumb slug={d.slug} alt="" className="w-20 shrink-0" />
                    <span className="min-w-0 text-sm">
                      <span className="block truncate font-semibold">{displayShortName(p.item, m)}</span>
                      <span className="price font-bold text-buy">{price(d.to, MARKETS[m].currency)}</span> <span className="text-xs text-win">−{d.pct}%</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {pairs.length > 0 && (
        <section>
          <h2 className="h-section mb-3">Popular comparisons</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pairs.map(([a, b]) => (
              <Link key={pairSlug(a.item, b.item)} href={`/compare/${pairSlug(a.item, b.item)}`} className="card flex items-center gap-3 p-3 text-fg no-underline hover:border-accent hover:no-underline">
                <ProductThumb slug={a.item.slug} alt="" className="w-20 shrink-0" />
                <span className="flex-1 text-center text-sm font-semibold leading-tight">
                  {displayShortName(a.item, m)} <span className="text-subtle">vs</span> {displayShortName(b.item, m)}
                </span>
                <ProductThumb slug={b.item.slug} alt="" className="w-20 shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="h-section">Newest cameras</h2>
          <Link href={marketPath(m, "/cameras")} className="text-sm">All cameras →</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cameras.slice(0, 8).map((c) => (
            <ProductCard key={c.slug} p={summarizeCamera(c, m)} market={m} />
          ))}
        </div>
      </section>

      {lenses.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="h-section">Newest lenses</h2>
            <Link href={marketPath(m, "/lenses")} className="text-sm">All lenses →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {lenses.slice(0, 8).map((l) => (
              <ProductCard key={l.slug} p={summarizeLens(l, m)} market={m} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="h-section mb-3">Camera systems</h2>
          <div className="flex flex-wrap gap-2">
            {systems.map((s) => (
              <Link key={s.slug} href={marketPath(m, `/mounts/${s.slug}`)} className="btn-ghost">{s.name}</Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="h-section mb-3">Brands</h2>
          <div className="flex flex-wrap gap-2">
            {live.map((b) => (
              <Link key={b.slug} href={marketPath(m, `/brands/${b.slug}`)} className="btn-ghost">{b.name}</Link>
            ))}
          </div>
        </div>
      </section>

      <section className="card grid gap-6 p-6 md:grid-cols-3">
        <div>
          <h2 className="font-bold">New and used, side by side</h2>
          <p className="mt-1 text-sm text-muted">Dealers&apos; new prices next to used and refurbished stock from used specialists and marketplaces, checked daily.</p>
        </div>
        <div>
          <h2 className="font-bold">Specs from the makers</h2>
          <p className="mt-1 text-sm text-muted">Every figure comes from the maker&apos;s own spec sheet. When we can&apos;t verify one, we show a dash instead of guessing.</p>
        </div>
        <div>
          <h2 className="font-bold">Sorted by price, always</h2>
          <p className="mt-1 text-sm text-muted">Some links earn us a commission. It never changes the order: the cheapest offer is first.</p>
        </div>
      </section>
    </div>
  );
}
