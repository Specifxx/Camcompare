import Link from "next/link";
import { price, listPrice } from "@/lib/format";
import { cardChips, cardSubline } from "@/lib/highlights";
import { marketPath, type MarketCode } from "@/lib/markets";
import { quickViewAttrs } from "@/lib/quickview";
import type { ProductSummary } from "@/lib/summary-types";
import ProductThumb from "./ProductThumb";
import QuickViewHost from "./QuickView";

export const subline = cardSubline;

// No prefetch: a grid holds up to 240 cards, and each prefetch is the whole
// product page's payload. Outside the US an unpriced product's page is
// rendered on its first request, so a prefetch would also be an ISR write
// for a noindex page nobody opened.
// Those unpriced pages are noindex, so their links are nofollow: crawlers
// don't spend a render (an ISR write and a function call) on each of them.
// A plain left click opens the quick view (QuickView.tsx); the href stays the
// product page for crawlers, middle-click and new tabs.
// Its long utility lists live in globals.css (.pc*): a grid repeats them on
// every card, in the HTML and again in the RSC payload.
export default function ProductCard({ p, market }: { p: ProductSummary; market: MarketCode }) {
  const now = p.lowestNew ?? p.lowestUsed;
  const chips = cardChips(p);
  return (
    <>
      <Link
        href={marketPath(market, `/${p.kind === "camera" ? "cameras" : "lenses"}/${p.slug}`)}
        prefetch={false}
        rel={market !== "us" && now === null ? "nofollow" : undefined}
        {...quickViewAttrs(p.slug, market, p.name)}
        className="card pc group"
      >
        <div className="relative">
          <ProductThumb slug={p.slug} alt={p.name} className="rounded-md" />
          <span aria-hidden className="pc-hint">
            {now !== null ? "Compare prices" : "Quick view"}
          </span>
        </div>
        <div className="flex-1">
          <p className="pc-brand">{p.brandName}</p>
          <p className="pc-name">{p.shortName}</p>
          <p className="pc-sub">{cardSubline(p)}</p>
          {/* Key specs on one line: "IBIS · 4K 60p · 658 g". */}
          {chips.length > 0 && (
            <ul className="exif pc-chips" aria-label="Key specs">
              {chips.map((c, i) => (
                <li key={c} className={i === 2 ? "hidden sm:inline" : undefined}>{c}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="pc-foot">
          {now !== null ? (
            <>
              <span className="text-xs text-subtle">{p.lowestNew !== null ? "New from " : "Used from "}</span>
              <span className="price font-bold text-buy">{price(now, p.currency)}</span>
              {p.lowestNew !== null && p.lowestUsed !== null && (
                <span className="block text-xs">
                  <span className="text-subtle">Used from </span>
                  <span className="price font-semibold">{price(p.lowestUsed, p.currency)}</span>
                </span>
              )}
              {p.stores > 0 && <span className="block text-xs text-subtle">at {p.stores} store{p.stores === 1 ? "" : "s"}</span>}
              {p.launch !== null && (
                <span className="block text-xs text-subtle">
                  Launch RRP <span className="price">{listPrice(p.launch, p.currency)}</span>
                </span>
              )}
            </>
          ) : p.launch ? (
            <span>
              <span className="text-xs text-subtle">Launch RRP </span>
              <span className="price font-semibold">{listPrice(p.launch, p.currency)}</span>
            </span>
          ) : (
            <span className="text-xs text-subtle">{p.status === "discontinued" ? "Discontinued" : "Not priced yet"}</span>
          )}
        </div>
      </Link>
      <QuickViewHost />
    </>
  );
}
