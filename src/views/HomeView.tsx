import type { Metadata } from "next";
import Link from "next/link";
import { GuideThumb } from "@/components/GuideThumb";
import ProductThumb from "@/components/ProductThumb";
import QuickViewHost from "@/components/QuickView";
import SearchBox from "@/components/SearchBox";
import DealVotes from "@/components/community/DealVotes";
import DealFeed, { type FeedRow } from "@/components/home/DealFeed";
import JustAnnounced from "@/components/releases/JustAnnounced";
import Freshness from "@/components/home/Freshness";
import MakersNote from "@/components/home/MakersNote";
import SectionHeading from "@/components/home/SectionHeading";
import EbayStrip from "@/components/home/EbayStrip";
import { brandName, brands, displayName, displayShortName, historyFor, indexedPairs, mounts, offersFor, offersGeneratedAt, pairSlug, product, publishedCameras, publishedLenses, type AnyProduct } from "@/lib/catalog";
import { affiliateUrl, isPaid, subId } from "@/lib/affiliate";
import { dealInputs } from "@/lib/deal-inputs";
import { readDealLog, type DealEntry } from "@/lib/deal-log";
import { isAmazonOffer } from "@/lib/offers";
import { packKind } from "@/lib/offer-rows";
import { price } from "@/lib/format";
import { latestGuides } from "@/lib/guides";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { quickViewAttrs } from "@/lib/quickview";
import { CONDITION_LABEL, retailer } from "@/lib/retailers";
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
/** Live deals on the feed at most (best saving first), and how long a gone one stays on it. */
const FEED_MAX = 200;
const GONE_SHOW_H = 48;
const SPARK_DAYS = 90;

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

  // ---- the deal feed: the deal log (lib/deal-log.ts, updated after each
  // import) joined with this build's offers for the links and our own price
  // history for the sparkline. Gone deals stay GONE_SHOW_H hours, stamped.
  const log = readDealLog(m);
  const inputs = new Map(dealInputs(m).map((it) => [it.slug, it]));
  const since = log?.updatedAt ? Date.parse(log.updatedAt) - GONE_SHOW_H * 3_600_000 : 0;
  const liveDeals = (log?.deals ?? [])
    .filter((d) => d.status === "live" && product(d.slug))
    .sort((a, b) => b.pct - a.pct || b.save - a.save)
    .slice(0, FEED_MAX);
  const goneDeals = (log?.deals ?? []).filter((d) => d.status === "gone" && d.goneAt && Date.parse(d.goneAt) >= since && product(d.slug));
  const toFeedRow = (d: DealEntry): FeedRow | null => {
    const p = product(d.slug)!;
    const gone = d.status === "gone" ? { at: d.goneAt!, why: d.goneWhy ?? "sold" } : null;
    let buy: FeedRow["buy"] = null;
    if (!gone) {
      const o = (inputs.get(d.slug)?.offers ?? []).filter((x) => x.retailer === d.retailer && x.condition === d.condition && x.inStock && !x.kit && !isAmazonOffer(x)).sort((a, b) => a.price - b.price)[0];
      // The log and the offers come from the same import; a deal whose offer is not in this build is not shown live.
      if (!o) return null;
      const href = affiliateUrl(o.retailer, o.url, subId("home", "feed"));
      buy = { href, paid: isPaid(o.retailer, href), retailer: o.retailer };
    }
    const field = d.condition === "new" ? "new" : "used";
    const pts = historyFor(d.slug, m)
      .filter((h) => h[field] !== undefined)
      .slice(-SPARK_DAYS)
      .map((h) => h[field]!);
    const pack = packKind(p);
    return {
      key: d.key,
      slug: d.slug,
      kind: d.kind,
      name: `${displayName(p.item, m)}${pack === "body" ? " body" : ""}`,
      cond: CONDITION_LABEL[d.condition].toLowerCase(),
      isNew: d.condition === "new",
      store: retailer(d.retailer)?.name ?? d.retailer,
      price: d.price,
      rrp: d.rrp,
      save: d.save,
      pct: d.pct,
      was: d.was ?? null,
      firstSeen: d.firstSeen,
      droppedAt: d.droppedAt ?? null,
      gone,
      href: marketPath(m, `/${d.kind === "camera" ? "cameras" : "lenses"}/${d.slug}`),
      buy,
      spark: pts,
      low90: pts.length >= 14 && d.price <= Math.min(...pts),
    };
  };
  const feed = [...liveDeals, ...goneDeals].map(toFeedRow).filter((r): r is FeedRow => r !== null);
  const board = feed.filter((r) => !r.gone).length >= MIN_DEALS;
  const fallback = board ? null : deals(m);

  const pairs = indexedPairs("camera")
    .sort((p, q) => newestOf(q).localeCompare(newestOf(p)))
    .slice(0, 6);
  const live = brands().filter((b) => all.some((p) => p.brand === b.slug));
  const brandTiles = live.map((b) => ({ ...b, n: all.filter((p) => p.brand === b.slug).length })).sort((a, b) => b.n - a.n);
  const systems = mounts().filter((mt) => mt.status === "current" && cameras.some((c) => c.mount === mt.slug));
  // Every guide, newest first: the articles are what search and ad crawlers read.
  // The three newest blog posts get cards right under the hero (owner, 2026-10-30:
  // "featured somewhere on the homepage"); every other post and guide stays a list lower down.
  const featured = latestGuides().filter((g) => g.kind === "blog").slice(0, 3);
  const guideList = latestGuides().filter((g) => !featured.includes(g));

  return (
    <div className="flex flex-col gap-14 sm:gap-16">
      {/* ---- small hero: one line and the search box */}
      <section aria-labelledby="hero-title" className="pt-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-subtle">
            {MARKETS[m].flag} Prices for {MARKETS[m].name} · {cur}
          </p>
          <h1 id="hero-title" className="mt-1 text-2xl font-semibold leading-tight sm:text-3xl">
            Camera &amp; lens prices, compared. Best deals first.
          </h1>
          <div className="mt-4 max-w-2xl">
            <SearchBox market={m} variant="hero" placeholder={`Search ${all.length.toLocaleString("en-US")} cameras & lenses`} />
          </div>
          <p className="mt-3 text-sm text-muted">
            or browse <Link href={marketPath(m, "/cameras")}>cameras</Link>, <Link href={marketPath(m, "/lenses")}>lenses</Link>, <Link href={marketPath(m, "/drones")}>drones</Link>, <Link href={marketPath(m, "/smart-glasses")}>smart glasses</Link>, or let us <Link href={marketPath(m, "/finder")}>help you choose</Link>
          </p>
          <div className="mt-3">
            <MakersNote board={board} place={PLACE[m]} />
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section aria-labelledby="blog-title" className="-mt-6 sm:-mt-8">
          <SectionHeading id="blog-title" eyebrow="From the blog" title="Best of 2026, with today's prices" href="/guides" link="All posts and guides" />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((g) => (
              <li key={g.slug}>
                <Link href={`/guides/${g.slug}`} prefetch={false} className="card group flex h-full flex-col overflow-hidden text-fg no-underline transition hover:-translate-y-0.5 hover:border-accent hover:no-underline">
                  <GuideThumb g={g} className="aspect-[16/9]" />
                  <span className="flex flex-1 flex-col p-4">
                    <span className="block font-display text-lg font-bold leading-snug group-hover:text-accent">{g.title}</span>
                    <span className="mt-1 line-clamp-2 block text-sm text-muted">{g.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- best deals */}
      <section aria-labelledby="deals-title">
        <div className="grid gap-6">
          <div className="order-1">
            <p className="text-xs font-medium uppercase tracking-wide text-subtle">Best deals in {PLACE[m]}</p>
            <h2 id="deals-title" className="mt-1 text-xl font-semibold leading-tight sm:text-2xl">
              {board ? <>The RRP, minus what it costs today</> : <>Today&apos;s best prices</>}
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm text-muted">
              {board
                ? "The launch list price against the cheapest one in stock at a shop we check, body or lens only, no kits. When one sells or goes out of stock it stays here, marked sold, so you can see what got snatched."
                : `We don't have launch prices for ${PLACE[m]} on enough of the catalog yet, so we can't honestly do the RRP sum here. Until we do, here is what the prices themselves say.`}
            </p>
            {generatedAt && (
              <p className="mt-2 text-xs text-subtle">
                <span className="cc-live" aria-hidden />
                Prices last checked <Freshness at={generatedAt} fallback={stamp(generatedAt)} />
              </p>
            )}
          </div>

          {board && (
            <div className="order-2">
              <DealFeed rows={feed} m={m} currency={cur} />
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
              // Whichever lists this market has; one alone takes the full width.
              const lists = [
                {
                  title: "Got cheaper this week",
                  rows: fallback.newDrops.map((d) => ({
                    slug: d.slug,
                    vote: `${m}:${d.slug}:drop`,
                    right: (
                      <>
                        <span className="price font-bold text-buy">{price(d.to, cur)}</span> <span className="block text-xs text-win">−{d.pct}% in a week</span>
                      </>
                    ),
                  })),
                },
                {
                  title: "Used for a lot less than new",
                  rows: fallback.savings.map((x) => ({
                    slug: x.slug,
                    vote: `${m}:${x.slug}:used-vs-new`,
                    right: (
                      <>
                        <span className="price font-bold text-buy">{price(x.u!.price, cur)}</span> <span className="text-xs text-subtle">used</span>
                        <span className="block text-xs text-win">
                          {x.pct}% under new {price(x.n!.price, cur)}
                        </span>
                      </>
                    ),
                  })),
                },
                {
                  // Needs no RRP or price history, so every market with two
                  // stores has some, and something to vote on.
                  title: "One store clearly cheapest",
                  rows: fallback.gaps.map((g) => ({
                    slug: g.slug,
                    vote: `${m}:${g.slug}:store-gap`,
                    right: (
                      <>
                        <span className="price font-bold text-buy">{price(g.best.price, cur)}</span> <span className="text-xs text-subtle">at {retailer(g.best.retailer)?.name ?? g.best.retailer}</span>
                        <span className="block text-xs text-win">{g.pct}% under the next store</span>
                      </>
                    ),
                  })),
                },
              ].filter((l) => l.rows.length);
              const solo = lists.length === 1;
              return (
                <div className="order-2 grid gap-8 md:grid-cols-2">
                  {lists.map((l) => (
                    <FallbackList key={l.title} m={m} wide={solo} title={l.title} rows={l.rows.slice(0, solo ? 12 : 8)} />
                  ))}
                  {!lists.length && <p className="text-sm text-muted md:col-span-2">No deals in {PLACE[m]} yet: we need two stores pricing the same product, a week of prices, or used and new side by side.</p>}
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

      <JustAnnounced market={m} />

      {/* ---- the rest, compact */}
      {pairs.length > 0 && (
        <section aria-labelledby="pairs-title">
          <SectionHeading id="pairs-title" eyebrow="Head to head" title="Cameras people keep cross-shopping" href="/compare" link="Compare any two" />
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pairs.map(([a, b]) => (
              <li key={pairSlug(a.item, b.item)}>
                <Link href={`/compare/${pairSlug(a.item, b.item)}`} prefetch={false} className="group flex items-center gap-2 border-b border-line py-2 text-sm font-semibold text-fg no-underline hover:no-underline">
                  <ProductThumb slug={a.item.slug} alt="" className="w-14 shrink-0" />
                  <span aria-hidden className="shrink-0 text-xs text-subtle">
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
          <SectionHeading id="guides-title" eyebrow="Read before you buy" title="Buying guides, minus the fluff" href="/guides" link="Blog and guides" />
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
            <span className="mr-1 text-xs font-medium uppercase tracking-wide text-subtle">Camera systems</span>
            {systems.map((s) => (
              <Link key={s.slug} href={marketPath(m, `/mounts/${s.slug}`)} prefetch={false} className="chip-link px-3 py-1 text-sm">
                {s.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      <EbayStrip market={m} />

      <section aria-label="Tell us" className="border-t border-line pt-6">
        <p className="font-semibold">Something missing or wrong?</p>
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

function FallbackList({ m, title, rows, wide }: { m: MarketCode; title: string; rows: { slug: string; vote: string; right: React.ReactNode }[]; wide: boolean }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <ul className={`mt-3 grid gap-2 ${wide ? "md:grid-cols-2" : ""}`}>
        {rows.map((r) => {
          const p = product(r.slug)!;
          return (
            <li key={r.slug} className="flex items-center gap-2">
              {/* Votes here too, so every market can vote, not only those with the RRP feed. */}
              <DealVotes dealKey={r.vote} layout="column" className="shrink-0" />
              <Link
                href={marketPath(m, `/${p.kind === "camera" ? "cameras" : "lenses"}/${r.slug}`)}
                prefetch={false}
                {...quickViewAttrs(r.slug, m, displayName(p.item, m))}
                className="card flex min-w-0 flex-1 items-center gap-3 p-2.5 text-fg no-underline hover:border-accent hover:no-underline"
              >
                <ProductThumb slug={r.slug} alt="" className="w-16 shrink-0" />
                <span className="min-w-0 flex-1 text-sm font-semibold">{displayName(p.item, m)}</span>
                <span className="shrink-0 text-right text-sm">{r.right}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
