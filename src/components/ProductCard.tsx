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
// A plain left click opens the quick view (QuickView.tsx); the href stays the
// product page for crawlers, middle-click and new tabs.
export default function ProductCard({ p, market }: { p: ProductSummary; market: MarketCode }) {
  const now = p.lowestNew ?? p.lowestUsed;
  const chips = cardChips(p);
  return (
    <>
      <Link
        href={marketPath(market, `/${p.kind === "camera" ? "cameras" : "lenses"}/${p.slug}`)}
        prefetch={false}
        {...quickViewAttrs(p.slug, market, p.name)}
        className="card group flex h-full flex-col gap-2 p-3 text-fg no-underline transition-[border-color,box-shadow] duration-150 hover:border-accent hover:no-underline hover:shadow-lg focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <div className="relative">
          <ProductThumb slug={p.slug} alt={p.name} />
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-1.5 mx-auto w-max rounded-full bg-fg/85 px-2.5 py-0.5 text-[11px] font-semibold text-bg opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {now !== null ? "Compare prices" : "Quick view"}
          </span>
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-subtle">{p.brandName}</p>
          <p className="font-semibold leading-tight group-hover:text-accent">{p.shortName}</p>
          <p className="mt-1 text-xs text-muted">{cardSubline(p)}</p>
          {chips.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1">
              {chips.map((c, i) => (
                <li key={c} className={`chip px-2 text-[10.5px] ${i === 2 ? "hidden sm:inline-flex" : ""}`}>{c}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="text-sm">
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
            </>
          ) : p.launch ? (
            <span>
              <span className="text-xs text-subtle">Launched at </span>
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
