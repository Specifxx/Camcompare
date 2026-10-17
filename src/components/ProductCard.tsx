import Link from "next/link";
import { price, listPrice, year } from "@/lib/format";
import { marketPath, type MarketCode } from "@/lib/markets";
import { sensorLabel } from "@/lib/specs/definitions";
import type { ProductSummary } from "@/lib/summary-types";
import ProductThumb from "./ProductThumb";

const aperture = (a: number) => `f/${a}`;

export function subline(p: ProductSummary): string {
  if (p.kind === "camera") return `${sensorLabel(p.sensor)} · ${p.megapixels} MP · ${year(p.announced)}`;
  const focal = p.focalMin === p.focalMax ? `${p.focalMin}mm` : `${p.focalMin}–${p.focalMax}mm`;
  return `${focal} ${p.apertureTele ? `${aperture(p.aperture)}–${p.apertureTele}` : aperture(p.aperture)} · ${year(p.announced)}`;
}

// No prefetch: a grid holds up to 240 cards, and each prefetch is the whole
// product page's payload. Outside the US an unpriced product's page is
// rendered on its first request, so a prefetch would also be an ISR write
// for a noindex page nobody opened.
export default function ProductCard({ p, market }: { p: ProductSummary; market: MarketCode }) {
  const now = p.lowestNew ?? p.lowestUsed;
  return (
    <Link href={marketPath(market, `/${p.kind === "camera" ? "cameras" : "lenses"}/${p.slug}`)} prefetch={false} className="card group flex h-full flex-col gap-2 p-3 text-fg no-underline hover:border-accent hover:no-underline">
      <ProductThumb slug={p.slug} alt={p.name} />
      <div className="flex-1">
        <p className="text-xs font-medium text-subtle">{p.brandName}</p>
        <p className="font-semibold leading-tight group-hover:text-accent">{p.shortName}</p>
        <p className="mt-1 text-xs text-muted">{subline(p)}</p>
      </div>
      <div className="text-sm">
        {now !== null ? (
          <span>
            <span className="text-xs text-subtle">{p.lowestNew !== null ? "New from " : "Used from "}</span>
            <span className="price font-bold text-buy">{price(now, p.currency)}</span>
          </span>
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
  );
}
