import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import ProductThumb from "@/components/ProductThumb";
import Reveal from "@/components/Reveal";
import Hero, { type HeroChip, type HeroStat } from "@/components/home/Hero";
import SectionHeading from "@/components/home/SectionHeading";
import { brandName, brands, displayName, displayShortName, historyAll, indexedPairs, mounts, pairSlug, product, publishedCameras, publishedLenses, type AnyProduct } from "@/lib/catalog";
import { price } from "@/lib/format";
import { guides } from "@/lib/guides";
import { priceDrops } from "@/lib/insights";
import { MARKET_CODES, MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { retailersFor } from "@/lib/retailers";
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
const PLACE: Record<MarketCode, string> = { us: "the US", uk: "the UK", eu: "Europe", au: "Australia", sg: "Singapore" };

const PILLARS = [
  { title: "New and used, side by side", text: "Dealers' new prices next to used and refurbished stock from used specialists and marketplaces, checked daily.", icon: "M4 7h16M4 12h10M4 17h7M17 14l3 3-3 3" },
  { title: "Specs from the makers", text: "Every figure comes from the maker's own spec sheet. When we can't verify one, we show a dash instead of guessing.", icon: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" },
  { title: "Sorted by price, always", text: "Some links earn us a commission. It never changes the order: the cheapest offer is first.", icon: "M7 4v16M4 17l3 3 3-3M14 6h6M14 11h4M14 16h2" },
];

export default function HomeView({ market: m }: { market: MarketCode }) {
  const cameras = publishedCameras();
  const lenses = publishedLenses();
  const all = [...cameras, ...lenses];
  const pairs = indexedPairs("camera").sort((p, q) => newestOf(q).localeCompare(newestOf(p))).slice(0, 9);
  const drops = priceDrops(historyAll(m), "new").slice(0, 4);
  const live = brands().filter((b) => cameras.some((c) => c.brand === b.slug) || lenses.some((l) => l.brand === b.slug));
  const systems = mounts().filter((mt) => mt.status === "current" && cameras.some((c) => c.mount === mt.slug));
  const shops = [...new Set(retailersFor(m).map((r) => r.name))];

  // "Popular" = most cross-shopped: named as a rival by the most products.
  const named = new Map<string, number>();
  for (const p of all) for (const r of p.rivals) named.set(r, (named.get(r) ?? 0) + 1);
  const popular = <T extends { slug: string; status: string; announced: string }>(list: T[]) =>
    list.filter((p) => p.status === "current" && p.announced >= "2020").sort((a, b) => (named.get(b.slug) ?? 0) - (named.get(a.slug) ?? 0) || b.announced.localeCompare(a.announced));
  const chips: HeroChip[] = [...popular(cameras).slice(0, 4), ...popular(lenses).slice(0, 2)].map((p) => ({
    href: marketPath(m, `/${cameras.includes(p as never) ? "cameras" : "lenses"}/${p.slug}`),
    label: cameras.includes(p as never) ? displayName(p, m) : `${brandName(p.brand)} ${displayShortName(p, m)}`,
  }));
  const stats: HeroStat[] = [
    { value: all.length.toLocaleString("en-US"), label: "Cameras & lenses" },
    { value: String(shops.length), label: `Retailers in ${MARKETS[m].short}` },
    { value: String(MARKET_CODES.length), label: "Markets" },
    { value: String(live.length), label: "Brands" },
  ];
  const brandTiles = live
    .map((b) => ({ ...b, n: all.filter((p) => p.brand === b.slug).length }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 12);
  // Newest first, all of them: the articles are what search and ad crawlers read.
  const guideList = [...guides()].sort((a, b) => b.updated.localeCompare(a.updated) || a.title.localeCompare(b.title)).slice(0, 10);

  return (
    <div className="flex flex-col gap-16 sm:gap-20">
      <Hero market={m} place={PLACE[m]} stats={stats} chips={chips} searchPlaceholder={`Search ${all.length.toLocaleString("en-US")} cameras & lenses`}>
        <Link href={marketPath(m, "/cameras")} className="btn-primary">Browse cameras</Link>
        <Link href={marketPath(m, "/lenses")} className="btn-ghost">Browse lenses</Link>
        <Link href={marketPath(m, "/finder")} className="btn-ghost">Help me choose</Link>
        <Link href={marketPath(m, "/deals")} className="btn-ghost">Price drops</Link>
      </Hero>

      {shops.length > 0 && (
        <section aria-labelledby="shops-title" className="-mt-6 sm:-mt-8">
          <h2 id="shops-title" className="eyebrow mb-3 text-center text-subtle">Retailers we compare in {PLACE[m]}</h2>
          <div className="cc-marquee">
            <div className="cc-marquee-inner">
              {[0, 1].map((k) => (
                <ul key={k} aria-hidden={k === 1 || undefined} className={`flex shrink-0 items-center gap-10 pr-10 ${k === 1 ? "cc-marquee-dup" : ""}`}>
                  {shops.map((s) => (
                    <li key={s} className="whitespace-nowrap font-display text-lg font-semibold tracking-tight text-fg/45">{s}</li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </section>
      )}

      {drops.length > 0 && (
        <section aria-labelledby="drops-title">
          <SectionHeading id="drops-title" eyebrow="Deals" title="Biggest price drops this week" href={marketPath(m, "/deals")} link="All deals" />
          <Reveal as="ul" stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {drops.map((d) => {
              const p = product(d.slug)!;
              return (
                <li key={d.slug}>
                  <Link href={marketPath(m, `/${p.kind === "camera" ? "cameras" : "lenses"}/${d.slug}`)} className="card group flex h-full items-center gap-3 p-3 text-fg no-underline hover:no-underline">
                    <ProductThumb slug={d.slug} alt="" className="cc-zoom w-20 shrink-0" />
                    <span className="min-w-0 text-sm">
                      <span className="block truncate font-semibold">{displayShortName(p.item, m)}</span>
                      <span className="price font-bold text-buy">{price(d.to, MARKETS[m].currency)}</span>{" "}
                      <span className="rounded-full bg-buy-soft px-1.5 py-0.5 text-xs font-semibold text-win">−{d.pct}%</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </Reveal>
        </section>
      )}

      {pairs.length > 0 && (
        <section aria-labelledby="pairs-title">
          <SectionHeading id="pairs-title" eyebrow="Head to head" title="Popular comparisons" href="/compare" link="Compare any two" />
          <Reveal as="div" stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pairs.map(([a, b]) => (
              <Link key={pairSlug(a.item, b.item)} href={`/compare/${pairSlug(a.item, b.item)}`} className="card group flex flex-col gap-3 p-3 text-fg no-underline hover:no-underline">
                <span className="relative grid grid-cols-2 gap-2">
                  <ProductThumb slug={a.item.slug} alt="" className="cc-zoom" />
                  <ProductThumb slug={b.item.slug} alt="" className="cc-zoom" />
                  <span aria-hidden className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-surface bg-gradient-to-br from-accent to-azure font-display text-xs font-bold text-accent-fg shadow-glow">
                    VS
                  </span>
                </span>
                <span className="grid grid-cols-2 gap-2 text-center text-sm font-semibold leading-tight">
                  <span>{displayShortName(a.item, m)}</span>
                  <span>{displayShortName(b.item, m)}</span>
                </span>
                <span className="sr-only">{displayShortName(a.item, m)} vs {displayShortName(b.item, m)}</span>
              </Link>
            ))}
          </Reveal>
        </section>
      )}

      {guideList.length > 0 && (
        <section aria-labelledby="guides-title">
          <SectionHeading id="guides-title" eyebrow="Read before you buy" title="Camera buying guides" href="/guides" link="All guides" />
          <Reveal as="ul" stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {guideList.map((g, i) => (
              <li key={g.slug} className={i === 0 ? "sm:col-span-2 lg:row-span-2" : ""}>
                <Link href={`/guides/${g.slug}`} prefetch={false} className="card group flex h-full flex-col p-5 text-fg no-underline hover:no-underline">
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-subtle">Guide · {Math.max(1, Math.round(g.words / 220))} min read</span>
                  <span className={`mt-2 font-display font-bold ${i === 0 ? "text-2xl sm:text-3xl" : "text-lg"} leading-snug tracking-tight group-hover:text-accent`}>{g.title}</span>
                  <span className="mt-2 line-clamp-3 flex-1 text-sm text-muted">{g.description}</span>
                  <span className="mt-4 text-sm font-semibold text-accent">Read <span aria-hidden>→</span></span>
                </Link>
              </li>
            ))}
          </Reveal>
        </section>
      )}

      <section aria-labelledby="cams-title">
        <SectionHeading id="cams-title" eyebrow="Just announced" title="Newest cameras" href={marketPath(m, "/cameras")} link="All cameras" />
        <Reveal stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cameras.slice(0, 8).map((c) => (
            <ProductCard key={c.slug} p={summarizeCamera(c, m)} market={m} />
          ))}
        </Reveal>
      </section>

      <section aria-labelledby="brands-title">
        <SectionHeading id="brands-title" eyebrow="Makers" title="Browse by brand" href={marketPath(m, "/brands")} link="All brands" />
        <Reveal as="ul" stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {brandTiles.map((b) => (
            <li key={b.slug}>
              <Link href={marketPath(m, `/brands/${b.slug}`)} className="card group relative flex h-full flex-col justify-between gap-4 overflow-hidden p-4 text-fg no-underline hover:no-underline">
                <span aria-hidden className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent/10 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
                <span className="font-display text-lg font-bold uppercase tracking-[0.06em]">{b.name}</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-subtle">
                  {b.n} products · {b.country}
                </span>
              </Link>
            </li>
          ))}
        </Reveal>
        {systems.length > 0 && (
          <Reveal className="mt-6 flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1 text-subtle">Camera systems</span>
            {systems.map((s) => (
              <Link key={s.slug} href={marketPath(m, `/mounts/${s.slug}`)} className="chip-link px-3 py-1 text-sm">
                {s.name}
              </Link>
            ))}
          </Reveal>
        )}
      </section>

      {lenses.length > 0 && (
        <section aria-labelledby="lenses-title">
          <SectionHeading id="lenses-title" eyebrow="Glass" title="Newest lenses" href={marketPath(m, "/lenses")} link="All lenses" />
          <Reveal stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {lenses.slice(0, 8).map((l) => (
              <ProductCard key={l.slug} p={summarizeLens(l, m)} market={m} />
            ))}
          </Reveal>
        </section>
      )}


      <Reveal as="section" stagger className="grid gap-3 md:grid-cols-3">
        {PILLARS.map((p) => (
          <div key={p.title} className="card relative overflow-hidden p-6">
            <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
            <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-azure text-accent-fg shadow-glow">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={p.icon} />
              </svg>
            </span>
            <h2 className="mt-4 text-base font-bold">{p.title}</h2>
            <p className="mt-1 text-sm text-muted">{p.text}</p>
          </div>
        ))}
      </Reveal>
    </div>
  );
}
