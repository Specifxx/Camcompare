// The deals page's "price traps" (lib/price-traps.ts): where the newer model
// costs more today than the older one, often on promotion. The first two get
// both products' history on one chart (PairPriceHistory, fetched by the
// browser); the rest are one line each.
import Link from "next/link";
import PairPriceHistory from "@/components/PairPriceHistory";
import { price } from "@/lib/format";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { priceTraps } from "@/lib/price-traps";

export default function PriceTraps({ market: m }: { market: MarketCode }) {
  const traps = priceTraps(m);
  if (!traps.length) return null;
  const cur = MARKETS[m].currency;
  return (
    <section id="price-traps" className="flex flex-col gap-3">
      <h2 className="h-section">Price traps: when the newer model costs more</h2>
      <p className="text-sm text-muted">
        A newer camera or lens is often sold as the cheaper alternative from its launch price, while the older one is on promotion for less. Today&apos;s lowest new prices in {MARKETS[m].name}:
      </p>
      <ul className="flex flex-col gap-3">
        {traps.map((t, i) => (
          <li key={`${t.older.slug}-${t.newer.slug}`} className="card p-3">
            <p className="text-sm">
              <strong>{t.newer.name}</strong> <span className="price font-semibold">{price(t.newer.price, cur)}</span> vs <strong>{t.older.name}</strong>{" "}
              <span className="price font-semibold text-win">{price(t.older.price, cur)}</span>
              {": "}the newer one costs <strong>{price(t.diff, cur)}</strong> ({t.pct}%) more
              {t.olderPromoPct !== null ? `, with the ${t.older.name} ${t.olderPromoPct}% under its launch price` : ""}
              {t.launchedCheaper ? `, though the ${t.newer.name} launched cheaper` : ""}.
            </p>
            {i < 2 ? (
              <div className="mt-2">
                <PairPriceHistory a={{ slug: t.older.slug, name: t.older.name, announced: t.older.announced }} b={{ slug: t.newer.slug, name: t.newer.name, announced: t.newer.announced }} market={m} pairPath={t.path.startsWith("/compare?") ? marketPath(m, t.path) : t.path} />
              </div>
            ) : (
              <p className="mt-1 text-sm">
                <Link href={t.path.startsWith("/compare?") ? marketPath(m, t.path) : t.path} prefetch={false}>
                  Compare them →
                </Link>
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
