import type { Metadata } from "next";
import Link from "next/link";
import ProductThumb from "@/components/ProductThumb";
import QuickViewHost from "@/components/QuickView";
import SearchBox from "@/components/SearchBox";
import DealCard from "@/components/home/DealCard";
import DealTabs from "@/components/home/DealTabs";
import Freshness from "@/components/home/Freshness";
import MakersNote from "@/components/home/MakersNote";
import SectionHeading from "@/components/home/SectionHeading";
import {
  brandName,
  brands,
  displayName,
  displayShortName,
  historyFor,
  indexedPairs,
  launchPrice,
  mounts,
  offersFor,
  offersGeneratedAt,
  pairSlug,
  product,
  publishedCameras,
  publishedLenses,
  type AnyProduct,
} from "@/lib/catalog";
import { homeDealViews, type HomeDeal, type HomeDealInput } from "@/lib/deals-home";
import { price } from "@/lib/format";
import { guides } from "@/lib/guides";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { quickViewAttrs } from "@/lib/quickview";
import { retailer } from "@/lib/retailers";
import { pageMeta } from "@/lib/seo";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { deals } from "@/views/DealsView";

export function homeMetadata(m: MarketCode): Metadata {
  return pageMeta({
    title: `${SITE_NAME}: ${SITE_TAGLINE}`,
    description: `The best camera and lens deals in ${MARKETS[m].name}: used and new prices against the RRP, plus specs side by side, at retailers we check every day.`,
    path: "/",
    market: m,
  });
}

const newestOf = ([a, b]: [AnyProduct, AnyProduct]) => (a.item.announced > b.item.announced ? a.item.announced : b.item.announced);
const PLACE: Record<MarketCode, string> = {
  us: "the US",
  uk: "the UK",
  eu: "Europe",
  au: "Australia",
  sg: "Singapore",
};
/** Below this many RRP deals a market gets the fallback lists instead (markets without launch prices). */
const MIN_DEALS = 6;
const SHOW = 24;

const stamp = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}, ${d.toISOString().slice(11, 16)} UTC`;
};

export default function HomeView({ market: m }: { market: MarketCode }) {
  const cur = MARKETS[m].currency;
  const cameras = publishedCameras();
  const lenses = publishedLenses();
  const all = [...cameras, ...lenses];
  const generatedAt = offersGeneratedAt(m);

  // ---- best deals: cheapest used (or new) offer against this market's RRP
  const items: HomeDealInput[] = [...cameras.map((p) => ({ p, kind: "camera" as const })), ...lenses.map((p) => ({ p, kind: "lens" as const }))].map(({ p, kind }) => {
    const l = launchPrice(p, m);
    return {
      slug: p.slug,
      kind,
      offers: offersFor(p.slug, m),
      rrpMinor: l && l.currency === cur ? Math.round(l.amount * 100) : null,
    };
  });
  const views = {
    used: homeDealViews(items, "used", SHOW),
    new: homeDealViews(items, "new", SHOW),
  };
  const count = (list: (HomeDeal & { inAll: boolean })[]) => ({
    all: list.filter((d) => d.inAll).length,
    camera: list.filter((d) => d.kind === "camera").length,
    lens: list.filter((d) => d.kind === "lens").length,
  });
  const counts = { used: count(views.used), new: count(views.new) };
  const board = counts.used.all >= MIN_DEALS || counts.new.all >= MIN_DEALS;
  const defaultMode = counts.used.all >= MIN_DEALS || counts.used.all >= counts.new.all ? "used" : "new";
  const fallback = board ? null : deals(m);

  // A handwritten note only where the numbers back it: the lowest price in at
  // least two weeks of our own history, or more than half off RRP.
  const noteFor = (d: HomeDeal, rank: number) => {
    const field = d.condition === "new" ? "new" : "used";
    const pts = historyFor(d.slug, m).filter((p) => p[field] !== undefined);
    if (pts.length >= 14 && d.price <= Math.min(...pts.map((p) => p[field]!))) return "lowest we've seen";
    if (rank === 0) return "biggest saving today";
    if (d.pct >= 50 && rank < 6) return "over half off!";
    return null;
  };

  const pairs = indexedPairs("camera")
    .sort((p, q) => newestOf(q).localeCompare(newestOf(p)))
    .slice(0, 6);
  const live = brands().filter((b) => all.some((p) => p.brand === b.slug));
  const brandTiles = live.map((b) => ({ ...b, n: all.filter((p) => p.brand === b.slug).length })).sort((a, b) => b.n - a.n);
  const systems = mounts().filter((mt) => mt.status === "current" && cameras.some((c) => c.mount === mt.slug));
  // Every guide, newest first: the articles are what search and ad crawlers read.
  const guideList = [...guides()].sort((a, b) => b.updated.localeCompare(a.updated) || a.title.localeCompare(b.title));

  const dealList = (mode: "used" | "new") =>
    views[mode].length > 0 && (
      <ul data-list={mode} className="hd-list">
        {(() => {
          let rankAll = 0;
          return views[mode].map((d, i) => {
            const p = product(d.slug)!;
            const rank = d.inAll ? rankAll++ : SHOW;
            return (
              <li key={d.slug} data-all={d.inAll ? "1" : "0"} data-k={d.kind}>
                <DealCard d={d} m={m} currency={cur} name={displayShortName(p.item, m)} brand={brandName(p.item.brand)} store={retailer(d.retailer)?.name ?? d.retailer} note={noteFor(d, rank)} i={i} />
              </li>
            );
          });
        })()}
      </ul>
    );

  return (
    <div className="flex flex-col gap-14 sm:gap-16">
      {/* ---- small hero: one line and the search box */}
      <section aria-labelledby="hero-title" className="hd-hero lg:grid lg:grid-cols-[1fr_21rem] lg:items-center lg:gap-12">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-subtle">
            {MARKETS[m].flag} Prices for {MARKETS[m].name} · {cur}
          </p>
          <h1 id="hero-title" className="mt-1.5 text-[1.6rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.2rem]">
            Camera &amp; lens prices, compared. <em className="cc-h1-em text-accent">Best deals first.</em>
          </h1>
          <div className="mt-4 max-w-2xl">
            <SearchBox market={m} variant="hero" placeholder={`Search ${all.length.toLocaleString("en-US")} cameras & lenses`} />
          </div>
          <p className="mt-3 text-sm text-muted">
            or browse <Link href={marketPath(m, "/cameras")}>cameras</Link>, <Link href={marketPath(m, "/lenses")}>lenses</Link>, or let us <Link href={marketPath(m, "/finder")}>help you choose</Link>
          </p>
        </div>
        {/* Wide screens: the note beside the hero. Narrow: after the deals (below). */}
        <div className="hidden lg:block">
          <MakersNote board={board} place={PLACE[m]} />
        </div>
      </section>

      {/* ---- best deals */}
      <section aria-labelledby="deals-title" className="-mt-4 sm:-mt-6">
        <div className="grid gap-6">
          <div className="order-1">
            <p className="eyebrow flex items-center gap-2">
              <span aria-hidden className="text-spark">
                ▶
              </span>
              Best deals in {PLACE[m]}
            </p>
            <h2 id="deals-title" className="mt-1.5 text-[1.65rem] font-semibold leading-tight tracking-[-0.015em] sm:text-[2rem]">
              {board ? <>The RRP, minus what it costs today</> : <>Today&apos;s best prices</>}
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm text-muted">
              {board
                ? "The launch list price against the cheapest one in stock at a shop we check, body or lens only, no kits. Sorted by how much you keep in your pocket."
                : `We don't have launch prices for ${PLACE[m]} on enough of the catalog yet, so we can't honestly do the RRP sum here. Until we do, here is what the prices themselves say.`}
            </p>
            {generatedAt && (
              <p className="mt-2 inline-flex items-center gap-2 text-xs text-subtle">
                <span aria-hidden className="cc-live-dot" />
                Prices last checked <Freshness at={generatedAt} fallback={stamp(generatedAt)} />
              </p>
            )}
          </div>
          <div className="order-3 mx-auto w-full max-w-xl lg:hidden">
            <MakersNote board={board} place={PLACE[m]} />
          </div>

          {board && (
            <div className="order-2">
              <DealTabs counts={counts} defaultMode={defaultMode}>
                {dealList("used")}
                {dealList("new")}
              </DealTabs>
              <p className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
                <Link href={marketPath(m, "/deals")} prefetch={false} className="btn-primary">
                  All deals and price drops <span aria-hidden>→</span>
                </Link>
                <span className="text-xs text-subtle">RRP is the maker&apos;s launch list price in {PLACE[m]}. Used prices are asking prices at shops, checked every few hours.</span>
              </p>
            </div>
          )}

          {fallback &&
            (() => {
              // One list alone takes the full width; an empty one only says so when both are.
              const dropsN = fallback.newDrops.length,
                savesN = fallback.savings.length;
              const solo = !dropsN || !savesN;
              return (
                <div className="order-2 grid gap-8 md:grid-cols-2">
                  <FallbackList
                    m={m}
                    hidden={!dropsN && savesN > 0}
                    wide={solo}
                    title="Got cheaper this week"
                    empty={`No new-price drops in ${PLACE[m]} this week. We need a week of prices to spot one.`}
                    rows={fallback.newDrops.slice(0, solo ? 12 : 8).map((d) => ({
                      slug: d.slug,
                      right: (
                        <>
                          <span className="price font-bold text-buy">{price(d.to, cur)}</span> <span className="block text-xs text-win">−{d.pct}% in a week</span>
                        </>
                      ),
                    }))}
                  />
                  <FallbackList
                    m={m}
                    hidden={!savesN && dropsN > 0}
                    wide={solo}
                    title="Used for a lot less than new"
                    empty={`Not enough used and new prices side by side in ${PLACE[m]} yet.`}
                    rows={fallback.savings.slice(0, solo ? 12 : 8).map((s) => ({
                      slug: s.slug,
                      right: (
                        <>
                          <span className="price font-bold text-buy">{price(s.u!.price, cur)}</span> <span className="text-xs text-subtle">used</span>
                          <span className="block text-xs text-win">
                            {s.pct}% under new {price(s.n!.price, cur)}
                          </span>
                        </>
                      ),
                    }))}
                  />
                  <p className="text-sm md:col-span-2">
                    <Link href={marketPath(m, "/deals")} prefetch={false} className="font-semibold">
                      Everything on the deals page <span aria-hidden>→</span>
                    </Link>
                  </p>
                </div>
              );
            })()}
        </div>
        <QuickViewHost />
      </section>

      {/* ---- the rest, compact */}
      {pairs.length > 0 && (
        <section aria-labelledby="pairs-title">
          <SectionHeading id="pairs-title" eyebrow="Head to head" title="Cameras people keep cross-shopping" href="/compare" link="Compare any two" />
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pairs.map(([a, b]) => (
              <li key={pairSlug(a.item, b.item)}>
                <Link href={`/compare/${pairSlug(a.item, b.item)}`} prefetch={false} className="card group flex items-center gap-2 p-2 text-sm font-semibold text-fg no-underline hover:no-underline">
                  <ProductThumb slug={a.item.slug} alt="" className="w-14 shrink-0" />
                  <span aria-hidden className="cc-hand shrink-0 text-lg text-accent">
                    vs
                  </span>
                  <ProductThumb slug={b.item.slug} alt="" className="w-14 shrink-0" />
                  <span className="min-w-0 leading-tight group-hover:text-accent">
                    {displayShortName(a.item, m)} <span className="font-normal text-subtle">vs</span> {displayShortName(b.item, m)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {guideList.length > 0 && (
        <section aria-labelledby="guides-title">
          <SectionHeading id="guides-title" eyebrow="Read before you buy" title="Buying guides, minus the fluff" href="/guides" link="All guides" />
          <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {guideList.map((g) => (
              <li key={g.slug} className="border-b border-dashed border-line py-2">
                <Link href={`/guides/${g.slug}`} prefetch={false} className="group block text-fg no-underline hover:no-underline">
                  <span className="font-display font-semibold leading-snug group-hover:text-accent">{g.title}</span>
                  <span className="ml-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-subtle">{Math.max(1, Math.round(g.words / 220))} min</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="brands-title">
        <SectionHeading id="brands-title" eyebrow="Makers" title="Pick your camp" href={marketPath(m, "/brands")} link="All brands" />
        <ul className="flex flex-wrap gap-2">
          {brandTiles.map((b) => (
            <li key={b.slug}>
              <Link href={marketPath(m, `/brands/${b.slug}`)} prefetch={false} className="chip-link px-3 py-1 text-sm">
                {b.name} <span className="ml-1 font-mono text-[10px] text-subtle">{b.n}</span>
              </Link>
            </li>
          ))}
        </ul>
        {systems.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1 text-subtle">Camera systems</span>
            {systems.map((s) => (
              <Link key={s.slug} href={marketPath(m, `/mounts/${s.slug}`)} prefetch={false} className="chip-link px-3 py-1 text-sm">
                {s.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Tell us" className="hd-letter mx-auto max-w-xl text-center">
        <p className="cc-hand text-2xl text-accent">Something missing or wrong?</p>
        <p className="mt-1 text-sm text-muted">
          A camera we don&apos;t list, a shop we should check, a price that looks off:{" "}
          <Link href="/feedback" prefetch={false} className="font-semibold">
            tell us what to fix or add
          </Link>
          . It comes straight to us.
        </p>
      </section>
    </div>
  );
}

function FallbackList({ m, title, rows, empty, wide, hidden }: { m: MarketCode; title: string; rows: { slug: string; right: React.ReactNode }[]; empty: string; wide: boolean; hidden: boolean }) {
  if (hidden) return null;
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className={`mt-3 grid gap-2 ${wide ? "md:grid-cols-2" : ""}`}>
          {rows.map((r) => {
            const p = product(r.slug)!;
            return (
              <li key={r.slug}>
                <Link
                  href={marketPath(m, `/${p.kind === "camera" ? "cameras" : "lenses"}/${r.slug}`)}
                  prefetch={false}
                  {...quickViewAttrs(r.slug, m, displayName(p.item, m))}
                  className="card flex items-center gap-3 p-2.5 text-fg no-underline hover:border-accent hover:no-underline"
                >
                  <ProductThumb slug={r.slug} alt="" className="w-16 shrink-0" />
                  <span className="min-w-0 flex-1 text-sm font-semibold">{displayName(p.item, m)}</span>
                  <span className="shrink-0 text-right text-sm">{r.right}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
