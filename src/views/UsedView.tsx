import type { Metadata } from "next";
import Link from "next/link";
import ProductThumb from "@/components/ProductThumb";
import QuickViewHost from "@/components/QuickView";
import EbayText from "@/components/ebay/EbayText";
import { quickViewAttrs } from "@/lib/quickview";
import { brandName, displayName, historyFor, offersFor, offersGeneratedAt, productPath, publishedCameras, publishedLenses, type AnyProduct } from "@/lib/catalog";
import { ebayLink } from "@/lib/ebay-links";
import { price } from "@/lib/format";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { lowest } from "@/lib/offers";
import { retailerQuery } from "@/lib/offer-rows";
import { retailer } from "@/lib/retailers";
import { pageMeta } from "@/lib/seo";
import { usedValue, type UsedValue } from "@/lib/value";

/**
 * The used price guide (DECISIONS.md, "Used price guide", 2026-10-27): every
 * camera and lens with a week or more of used asking prices in a market, with
 * its typical used price, the usual range and today's cheapest used offer, and
 * a tagged eBay used search. Product pages already carry this per product
 * ("Used: what it should be worth"); this page answers "what are used cameras
 * worth" in one place. Static, from the committed price history.
 */
export type UsedRow = { p: AnyProduct; v: UsedValue; cheapest: { price: number; store: string } | null };

/** Rows a market can show: products with a typical used price, most-listed first within each kind. */
export function usedRows(m: MarketCode): { cameras: UsedRow[]; lenses: UsedRow[] } {
  const row = (p: AnyProduct): UsedRow | null => {
    const v = usedValue(historyFor(p.item.slug, m));
    if (!v) return null;
    const u = lowest(offersFor(p.item.slug, m), "used");
    return { p, v, cheapest: u ? { price: u.price, store: retailer(u.retailer)?.name ?? u.retailer } : null };
  };
  const sort = (a: UsedRow, b: UsedRow) => b.v.listings - a.v.listings || a.p.item.slug.localeCompare(b.p.item.slug);
  const pick = (ps: AnyProduct[]) => ps.map(row).filter((r): r is UsedRow => !!r).sort(sort);
  return {
    cameras: pick(publishedCameras().map((item) => ({ kind: "camera" as const, item }))),
    lenses: pick(publishedLenses().map((item) => ({ kind: "lens" as const, item }))),
  };
}

// A guide with a handful of rows is thin: noindex and out of the sitemap until
// the market has at least ten products with a typical used price.
export const USED_MIN_ROWS = 10;
export const usedIndexable = (m: MarketCode) => {
  const r = usedRows(m);
  return r.cameras.length + r.lenses.length >= USED_MIN_ROWS;
};

export function usedMetadata(m: MarketCode): Metadata {
  return pageMeta({
    title: "Used camera and lens prices: what they're worth",
    description: `What used cameras and lenses sell for in ${MARKETS[m].name}: the typical used price, the usual range and today's cheapest used offer for every model we track, from the asking prices at used dealers, checked every few hours.`,
    path: "/used",
    market: m,
    index: usedIndexable(m),
    indexable: usedIndexable,
  });
}

function Table({ rows, m, title, id }: { rows: UsedRow[]; m: MarketCode; title: string; id: string }) {
  const cur = MARKETS[m].currency;
  if (!rows.length) return null;
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="h-section mb-3">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2 pr-3 font-semibold">Model</th>
              <th className="py-2 pr-3 text-right font-semibold">Typical used</th>
              <th className="py-2 pr-3 text-right font-semibold">Usual range</th>
              <th className="py-2 pr-3 text-right font-semibold">Cheapest used today</th>
              <th className="py-2 font-semibold">eBay</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, v, cheapest }) => {
              const name = displayName(p.item, m);
              const e = ebayLink(m, { query: retailerQuery(p, m), condition: "used" }, `used-${m}`, "used-ebay", "Used on eBay");
              return (
                <tr key={p.item.slug} className="border-t border-line align-middle">
                  <td className="py-2 pr-3">
                    <Link href={marketPath(m, productPath(p))} prefetch={false} {...quickViewAttrs(p.item.slug, m, name)} className="flex items-center gap-3 font-semibold">
                      <ProductThumb slug={p.item.slug} alt="" className="w-14 shrink-0" />
                      <span>
                        {name}
                        <span className="block text-xs font-normal text-subtle">{brandName(p.item.brand)}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="price py-2 pr-3 text-right font-bold">{price(v.value, cur)}</td>
                  <td className="price py-2 pr-3 text-right text-muted">
                    {price(v.low, cur)} to {price(v.high, cur)}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {cheapest ? (
                      <>
                        <span className={`price font-semibold ${cheapest.price < v.value ? "text-buy" : ""}`}>{price(cheapest.price, cur)}</span>
                        <span className="block text-xs text-subtle">{cheapest.store}</span>
                      </>
                    ) : (
                      <span className="text-subtle">None in stock</span>
                    )}
                  </td>
                  <td className="py-2 text-xs">{e && <EbayText link={e} product={p.item.slug} placement="used-ebay">{e.label}</EbayText>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function UsedView({ market: m }: { market: MarketCode }) {
  const { cameras, lenses } = usedRows(m);
  const updated = offersGeneratedAt(m);
  const empty = !cameras.length && !lenses.length;
  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Used camera and lens prices in {MARKETS[m].name}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          What a used camera or lens is worth: the typical used asking price over the last 90 days at the used dealers we track, the usual range (most listings fall
          between the two figures) and today&apos;s cheapest used offer. Asking prices, not confirmed sales. Most-listed models first.
          {updated ? ` Prices checked ${new Date(updated).toUTCString().slice(5, 16)}.` : ""}
        </p>
        <p className="mt-1 text-sm">
          Selling? Price yours near the typical figure. Buying? Anything under it is worth a look: see <Link href={marketPath(m, "/deals")} prefetch={false}>today&apos;s used deals</Link>.
        </p>
      </div>
      {empty && (
        <p className="card p-6 text-sm text-muted">
          Nothing yet: a model appears here after a week of used prices in {MARKETS[m].name}. Until then, <Link href={marketPath(m, "/cameras")}>browse cameras</Link>.
        </p>
      )}
      <Table rows={cameras} m={m} title="Used cameras" id="used-cameras" />
      <Table rows={lenses} m={m} title="Used lenses" id="used-lenses" />
      <QuickViewHost />
    </div>
  );
}
