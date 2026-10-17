import type { Metadata } from "next";
import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import { AD_SLOTS } from "@/lib/ads";
import ProductThumb from "@/components/ProductThumb";
import QuickViewHost from "@/components/QuickView";
import { quickViewAttrs } from "@/lib/quickview";
import { displayName, historyAll, historyFor, launchPrice, offersGeneratedAt, offersFor, product, publishedCameras, publishedLenses } from "@/lib/catalog";
import { price } from "@/lib/format";
import { priceDrops, topBargains, usedSaving, type Bargain } from "@/lib/insights";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { lowest } from "@/lib/offers";
import { retailer } from "@/lib/retailers";
import { pageMeta } from "@/lib/seo";
import { usedValue } from "@/lib/value";

/**
 * Today's top bargains in a market: new under its launch RRP, used under the
 * typical used price (lib/insights.ts topBargains). Shared with the home page.
 */
export function bargains(m: MarketCode, max = 12) {
  const cur = MARKETS[m].currency;
  const items = [...publishedCameras(), ...publishedLenses()].map((p) => {
    const l = launchPrice(p, m);
    return { slug: p.slug, offers: offersFor(p.slug, m), rrpMinor: l && l.currency === cur ? Math.round(l.amount * 100) : null, usedTypicalMinor: usedValue(historyFor(p.slug, m))?.value ?? null };
  });
  return { newBargains: topBargains(items, "new", 5, max), usedBargains: topBargains(items, "used", 5, max) };
}

/** A market's deals. `empty` until it has a week of history or a used saving. */
export function deals(m: MarketCode) {
  const history = historyAll(m);
  const newDrops = priceDrops(history, "new").slice(0, 24);
  const usedDrops = priceDrops(history, "used").slice(0, 12);
  const savings = [...publishedCameras(), ...publishedLenses()]
    .map((p) => {
      const o = offersFor(p.slug, m);
      const n = lowest(o, "new");
      const u = lowest(o, "used");
      return { slug: p.slug, n, u, pct: usedSaving(n?.price ?? null, u?.price ?? null) };
    })
    .filter((x) => x.pct !== null && x.pct >= 15)
    .sort((a, b) => b.pct! - a.pct!)
    .slice(0, 12);
  const { newBargains, usedBargains } = bargains(m);
  return { newDrops, usedDrops, savings, newBargains, usedBargains, empty: !newDrops.length && !usedDrops.length && !savings.length && !newBargains.length && !usedBargains.length };
}

// An empty deals page is one line of "nothing yet": noindex, out of the
// sitemap and hreflang, and without the ad slot (an ad on a page with no
// content is an AdSense violation) until the market has some.
export const dealsIndexable = (m: MarketCode) => !deals(m).empty;

export function dealsMetadata(m: MarketCode): Metadata {
  return pageMeta({
    title: "Camera and lens deals and price drops",
    description: `The cameras and lenses furthest under their launch RRP in ${MARKETS[m].name} today, the cheapest used against the typical used price, and this week's price drops. From our own price history.`,
    path: "/deals",
    market: m,
    index: dealsIndexable(m),
    indexable: dealsIndexable,
  });
}

/** One bargain as a card: photo, name, price, % under, store. */
export function BargainCard({ b, m }: { b: Bargain; m: MarketCode }) {
  const p = product(b.slug)!;
  const cur = MARKETS[m].currency;
  const name = displayName(p.item, m);
  return (
    <Link href={marketPath(m, `/${p.kind === "camera" ? "cameras" : "lenses"}/${b.slug}`)} prefetch={false} {...quickViewAttrs(b.slug, m, name)} className="card group flex h-full flex-col gap-2 p-3 text-fg no-underline hover:no-underline">
      <span className="relative block">
        <ProductThumb slug={b.slug} alt="" className="rounded-md" />
        <span className="absolute left-1.5 top-1.5 rounded bg-buy px-2 py-0.5 text-xs font-bold text-buy-fg">−{b.pct}%</span>
      </span>
      <span className="text-[15px] font-semibold leading-snug group-hover:text-accent">{name}</span>
      <span className="mt-auto text-sm">
        <span className="price font-bold text-buy">{price(b.price, cur)}</span> <span className="text-xs text-subtle">{b.condition === "new" ? "new" : "used"}</span>
        <span className="block text-xs text-win">
          {b.pct}% under {b.condition === "new" ? "launch RRP" : "typical used"} {price(b.ref, cur)}
        </span>
        <span className="block truncate text-xs text-subtle">at {retailer(b.retailer)?.name ?? b.retailer}</span>
      </span>
    </Link>
  );
}

function Row({ slug, m, right }: { slug: string; m: MarketCode; right: React.ReactNode }) {
  const p = product(slug)!;
  return (
    <li>
      <Link href={marketPath(m, `/${p.kind === "camera" ? "cameras" : "lenses"}/${slug}`)} prefetch={false} {...quickViewAttrs(slug, m, displayName(p.item, m))} className="card flex items-center gap-3 p-3 text-fg no-underline hover:no-underline">
        <ProductThumb slug={slug} alt="" className="w-20 shrink-0" />
        <span className="min-w-0 flex-1 text-sm font-semibold">{displayName(p.item, m)}</span>
        <span className="shrink-0 text-right text-sm">{right}</span>
      </Link>
    </li>
  );
}

export default function DealsView({ market: m }: { market: MarketCode }) {
  const cur = MARKETS[m].currency;
  const { newDrops, usedDrops, savings, newBargains, usedBargains, empty } = deals(m);
  const updated = offersGeneratedAt(m);
  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Camera deals in {MARKETS[m].name}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          From our own record of the lowest in-stock price at each retailer: today against the launch RRP, the typical used price and a week ago. No sponsored placements.
          {updated ? ` Prices checked ${new Date(updated).toUTCString().slice(5, 16)}.` : ""}
        </p>
        <p className="mt-1 text-sm"><Link href={marketPath(m, "/board")} prefetch={false}>Deals board (plain HTML)</Link></p>
      </div>
      {empty && (
        <p className="card p-6 text-sm text-muted">
          Nothing to show yet: bargains appear once {MARKETS[m].short} retailers send prices, and price drops after a week of price history. Until then, <Link href={marketPath(m, "/cameras")}>browse cameras</Link> or{" "}
          <Link href={marketPath(m, "/lenses")}>lenses</Link>.
        </p>
      )}
      {(newBargains.length > 0 || usedBargains.length > 0) && (
        <section aria-labelledby="bargains-title">
          <h2 id="bargains-title" className="h-section mb-1">Top bargains</h2>
          <p className="mb-3 text-sm text-muted">Today&apos;s lowest in-stock price against the maker&apos;s launch RRP in {MARKETS[m].name} (new), or against the typical used asking price we&apos;ve recorded (used). Body only; kits and Amazon left out.</p>
          {newBargains.length > 0 && (
            <>
              <h3 className="mb-2 text-sm font-bold text-muted">New, furthest under RRP</h3>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {newBargains.map((b) => (
                  <li key={b.slug}>
                    <BargainCard b={b} m={m} />
                  </li>
                ))}
              </ul>
            </>
          )}
          {usedBargains.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 text-sm font-bold text-muted">Used, furthest under the typical used price</h3>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {usedBargains.map((b) => (
                  <li key={b.slug}>
                    <BargainCard b={b} m={m} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      {newDrops.length > 0 && (
        <section>
          <h2 className="h-section mb-3">New: biggest drops this week</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {newDrops.map((d) => (
              <Row key={d.slug} slug={d.slug} m={m} right={<><span className="price font-bold text-buy">{price(d.to, cur)}</span><br /><span className="text-xs text-win">−{d.pct}% from {price(d.from, cur)}</span></>} />
            ))}
          </ul>
        </section>
      )}
      {usedDrops.length > 0 && (
        <section>
          <h2 className="h-section mb-3">Used: biggest drops this week</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {usedDrops.map((d) => (
              <Row key={d.slug} slug={d.slug} m={m} right={<><span className="price font-bold">{price(d.to, cur)}</span><br /><span className="text-xs text-win">−{d.pct}% from {price(d.from, cur)}</span></>} />
            ))}
          </ul>
        </section>
      )}
      {savings.length > 0 && (
        <section>
          <h2 className="h-section mb-3">Where buying used saves the most</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {savings.map((x) => (
              <Row key={x.slug} slug={x.slug} m={m} right={<><span className="price font-bold">{price(x.u!.price, cur)}</span> <span className="text-xs text-subtle">used</span><br /><span className="text-xs text-win">{x.pct}% under {price(x.n!.price, cur)} new</span></>} />
            ))}
          </ul>
        </section>
      )}
      {!empty && <AdSlot slot={AD_SLOTS.listing} />}
      {!empty && <QuickViewHost />}
    </div>
  );
}
