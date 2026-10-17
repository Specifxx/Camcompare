// One row on the home deals board: photo, name, RRP struck through, the
// cheapest used (or new) price and where, and the saving in big type. A plain
// click opens the quick view (QuickView.tsx); the href is the product page.
import Link from "next/link";
import type { CSSProperties } from "react";
import ProductThumb from "@/components/ProductThumb";
import { price } from "@/lib/format";
import type { HomeDeal } from "@/lib/deals-home";
import { marketPath, type Currency, type MarketCode } from "@/lib/markets";
import { quickViewAttrs } from "@/lib/quickview";
import { CONDITION_LABEL } from "@/lib/retailers";

export type DealCardProps = {
  d: HomeDeal;
  m: MarketCode;
  currency: Currency;
  name: string;
  brand: string;
  store: string;
  /** A short handwritten note on the card ("lowest we've seen"), only where the numbers back it up. */
  note: string | null;
  i: number;
};

export default function DealCard({ d, m, currency, name, brand, store, note, i }: DealCardProps) {
  const cond = CONDITION_LABEL[d.condition];
  const href = marketPath(m, `/${d.kind === "camera" ? "cameras" : "lenses"}/${d.slug}`);
  // A tiny, stable tilt per card: price tags stuck on by hand, not by a grid.
  const tilt = [-3, 2, -1.5, 3, -2.5, 1.5][i % 6];
  return (
    <Link href={href} prefetch={false} {...quickViewAttrs(d.slug, m, name)} className="card hd-card group text-fg no-underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50" style={{ "--tag": `${tilt}deg` } as CSSProperties}>
      <span className="hd-photo">
        <ProductThumb slug={d.slug} alt="" priority={i < 2} className="cc-zoom rounded-[3px]" />
        <span aria-hidden className="hd-tag">−{d.pct}%</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-subtle">{brand}</span>
        <span className="font-display text-[1.02rem] font-semibold leading-tight tracking-[-0.01em] group-hover:text-accent sm:text-[1.08rem]">{name}</span>
        <span className="mt-1.5 text-xs text-muted">
          RRP <s className="price">{price(d.rrp, currency)}</s>
        </span>
        <span className="text-sm">
          <span className="text-muted">{d.condition === "new" ? "New" : cond} from </span>
          <span className="price font-bold text-fg">{price(d.price, currency)}</span>
          <span className="text-muted"> at {store}</span>
        </span>
        <span className="hd-save mt-1.5">
          Save <span className="price">{price(d.save, currency)}</span> <span className="hd-save-pct">({d.pct}%)</span>
          {d.condition !== "new" && <span className="ml-1.5 align-middle font-sans text-[11px] font-medium text-muted">{cond.toLowerCase()}</span>}
        </span>
        {d.other !== null && (
          <span className="mt-0.5 text-xs text-subtle">
            {d.condition === "new" ? "Used from " : "New from "}
            <span className="price">{price(d.other, currency)}</span>
          </span>
        )}
      </span>
      {note && (
        <span aria-hidden className="hd-note cc-hand">
          {note}
        </span>
      )}
      {note && <span className="sr-only">{note}</span>}
    </Link>
  );
}
