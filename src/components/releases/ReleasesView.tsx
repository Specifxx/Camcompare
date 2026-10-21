// /releases and /<market>/releases: "Just announced". Makers' own launch
// videos and press releases (data/releases.json, scripts/fetch-releases.ts),
// newest first, each with the stores in this market that take orders for
// what it names. Static: built from committed files, no revalidate, no server
// reads; comments and alerts are client fetches after the page loads.
import type { Metadata } from "next";
import Link from "next/link";
import OutboundLink from "@/components/OutboundLink";
import ProductThumb from "@/components/ProductThumb";
import { affiliateUrl, isPaid, subId } from "@/lib/affiliate";
import { displayShortName, offersFor, product, productPath } from "@/lib/catalog";
import { price } from "@/lib/format";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { releaseBrandName } from "@/lib/releases/brands";
import type { Release } from "@/lib/releases/core";
import { announcements, readReleases } from "@/lib/releases/data";
import { ORDER_STATE_LABEL, storeRows, type StoreRow } from "@/lib/releases/stock";
import { retailer } from "@/lib/retailers";
import { pageMeta } from "@/lib/seo";
import LiteYouTube from "./LiteYouTube";
import { Ago, BrandFilter, ReleaseComments } from "./ReleaseClient";
import { BrandFollow, OrderNotify } from "./ReleaseNotify";

/** Cards on the page at most (the file keeps six months). */
const PAGE_MAX = 60;

/** The stores in this market that list what a release names, best state first. */
export function releaseStores(r: Release, m: MarketCode): StoreRow[] {
  return storeRows(r.products.filter((s) => product(s)).flatMap((s) => offersFor(s, m)));
}

// A market's version says something its own only once a store there lists a
// product from a release; until then it is noindex and out of hreflang (the
// rule for every market page, CLAUDE.md "Markets").
export const releasesIndexable = (m: MarketCode) => m === "us" || announcements().some((r) => releaseStores(r, m).length > 0);

export function releasesMetadata(m: MarketCode): Metadata {
  return pageMeta({
    title: "Just announced: new cameras, lenses and gear",
    description: `New cameras, lenses, lights and audio gear the moment the maker announces them, with the launch video and which stores in ${MARKETS[m].name} take preorders. Get an email when one opens.`,
    path: "/releases",
    market: m,
    index: releasesIndexable(m),
    indexable: releasesIndexable,
  });
}

const STATE_CLASS: Record<StoreRow["state"], string> = {
  in_stock: "border-win/40 bg-buy-soft text-win",
  preorder: "border-accent/40 bg-accent-soft text-accent",
  backorder: "border-warn/40 bg-warn/10 text-warn",
  out: "border-line bg-raised text-muted",
};

export function StateBadge({ state }: { state: StoreRow["state"] }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATE_CLASS[state]}`}>{ORDER_STATE_LABEL[state]}</span>;
}

/** The maker's name as a small wordmark: text, never a logo image (we have no rights to theirs). */
export function BrandMark({ brand }: { brand: string }) {
  return <span className="inline-flex items-center rounded bg-fg px-1.5 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-bg">{releaseBrandName(brand)}</span>;
}

function Stores({ r, m }: { r: Release; m: MarketCode }) {
  const rows = releaseStores(r, m);
  const cur = MARKETS[m].currency;
  if (!rows.length)
    return (
      <p className="text-sm text-muted">
        No store we check in {MARKETS[m].name} lists it yet. We look again after every price update.
      </p>
    );
  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {rows.map(({ offer: o, state }) => {
        const href = affiliateUrl(o.retailer, o.url, subId("releases", r.id));
        const paid = isPaid(o.retailer, href);
        const p = product(o.product);
        return (
          <li key={`${o.retailer}-${o.product}`} className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">{retailer(o.retailer)?.name ?? o.retailer}</p>
              <p className="truncate text-xs text-muted">
                {p ? displayShortName(p.item, m) : o.product}
                {o.kit ? " · kit" : ""}
                {o.promo ? ` · ${o.promo}` : ""}
              </p>
            </div>
            <StateBadge state={state} />
            <span className={`price w-20 shrink-0 text-right text-sm font-bold ${state === "out" ? "text-muted" : ""}`}>{price(o.price, cur)}</span>
            <div className="w-16 shrink-0 text-right">
              <OutboundLink href={href} retailer={o.retailer} product={o.product} placement="releases" className={`${paid ? "btn-buy" : "btn-ghost"} w-full px-2 text-xs`}>
                {state === "preorder" ? "Preorder" : state === "in_stock" ? "Buy" : "View"}
                <span className="sr-only"> at {retailer(o.retailer)?.name ?? o.retailer}</span>
              </OutboundLink>
              {paid && <p className="mt-0.5 text-[10px] leading-none text-subtle">Paid link</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ReleaseCard({ r, m, first }: { r: Release; m: MarketCode; first: boolean }) {
  const named = r.products.map((s) => product(s)).filter((p): p is NonNullable<typeof p> => p !== null);
  const rows = releaseStores(r, m);
  const orderable = rows.some((x) => x.state === "in_stock" || x.state === "preorder");
  return (
    <article id={r.id} data-brand={r.brand} className="card scroll-mt-24 p-4 sm:p-5">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtle">
        <BrandMark brand={r.brand} />
        <span>{r.kind === "video" ? "Launch video" : "Press release"}</span>
        <span aria-hidden>·</span>
        <Ago at={r.publishedAt} />
        {first && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-fg">Latest</span>}
      </header>
      <h2 className="mt-2 text-lg font-semibold leading-snug">
        <a href={r.url} target="_blank" rel="noopener" className="text-fg hover:text-accent">
          {r.title}
        </a>
      </h2>
      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        {r.videoId ? (
          <LiteYouTube id={r.videoId} title={r.title} />
        ) : (
          <a href={r.url} target="_blank" rel="noopener" className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-line bg-raised p-4 text-center text-sm font-semibold no-underline">
            Read the announcement on {releaseBrandName(r.brand)}&apos;s site →
          </a>
        )}
        <div className="flex min-w-0 flex-col gap-3">
          {named.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Products in this announcement">
              {named.map((p) => (
                <li key={p.item.slug}>
                  <Link href={marketPath(m, productPath(p))} prefetch={false} className="flex items-center gap-2 rounded-lg border border-line py-1 pl-1 pr-3 text-sm font-semibold text-fg no-underline hover:border-accent hover:no-underline">
                    <ProductThumb slug={p.item.slug} alt="" className="w-12 shrink-0" />
                    {displayShortName(p.item, m)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div>
            <h3 className="mb-1.5 text-sm font-bold">Where to preorder or buy in {MARKETS[m].name}</h3>
            <Stores r={r} m={m} />
          </div>
          <div className="mt-auto flex flex-wrap items-start gap-2">
            {!orderable && <OrderNotify kind="release" slug={r.id} market={m} />}
            <ReleaseComments id={r.id} name={releaseBrandName(r.brand)} />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function ReleasesView({ market: m }: { market: MarketCode }) {
  const list = announcements().slice(0, PAGE_MAX);
  const file = readReleases();
  const counts = new Map<string, number>();
  for (const r of list) counts.set(r.brand, (counts.get(r.brand) ?? 0) + 1);
  const brands = [...counts].map(([key, n]) => ({ key, name: releaseBrandName(key), n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-subtle">
          {MARKETS[m].flag} Stores in {MARKETS[m].name}
        </p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight sm:text-3xl">Just announced</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">
          New cameras, lenses and gear straight from the makers&apos; own channels and newsrooms, newest first. Under each one, the stores in {MARKETS[m].name} that take orders for it: stores only, never marketplace resellers.
        </p>
        {file.generatedAt && (
          <p className="mt-2 text-xs text-subtle">
            <span className="cc-live" aria-hidden />
            Checked <Ago at={file.generatedAt} />
          </p>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <aside className="lg:sticky lg:top-20 lg:order-2">
          <BrandFollow market={m} collapsible />
        </aside>
        <div className="flex min-w-0 flex-col gap-4 lg:order-1">
          {list.length ? (
            <>
              <BrandFilter brands={brands} target="release-feed" />
              <div id="release-feed" className="flex flex-col gap-4">
                {list.map((r, i) => (
                  <ReleaseCard key={r.id} r={r} m={m} first={i === 0} />
                ))}
              </div>
            </>
          ) : (
            <p className="card p-4 text-sm text-muted">Nothing announced yet. The first check runs with the next price update.</p>
          )}
        </div>
      </div>
      <p className="text-xs text-subtle">
        Videos and announcements belong to their makers; we link and embed them as published. A card here means the maker said it, not that it can be bought: the store list says that.
      </p>
    </div>
  );
}
