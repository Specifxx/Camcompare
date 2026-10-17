import type { Metadata } from "next";
import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import { AD_SLOTS } from "@/lib/ads";
import ProductThumb from "@/components/ProductThumb";
import { displayName, historyAll, offersGeneratedAt, offersFor, product, publishedCameras, publishedLenses } from "@/lib/catalog";
import { price } from "@/lib/format";
import { priceDrops, usedSaving } from "@/lib/insights";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { lowest } from "@/lib/offers";
import { pageMeta } from "@/lib/seo";

export function dealsMetadata(m: MarketCode): Metadata {
  return pageMeta({
    title: "Camera and lens price drops",
    description: `Cameras and lenses whose lowest price in ${MARKETS[m].name} fell this week, and where buying used saves the most. From our daily price history.`,
    path: "/deals",
    market: m,
  });
}

function Row({ slug, m, right }: { slug: string; m: MarketCode; right: React.ReactNode }) {
  const p = product(slug)!;
  return (
    <li>
      <Link href={marketPath(m, `/${p.kind === "camera" ? "cameras" : "lenses"}/${slug}`)} className="card flex items-center gap-3 p-3 text-fg no-underline hover:border-accent hover:no-underline">
        <ProductThumb slug={slug} alt="" className="w-20 shrink-0" />
        <span className="min-w-0 flex-1 text-sm font-semibold">{displayName(p.item, m)}</span>
        <span className="shrink-0 text-right text-sm">{right}</span>
      </Link>
    </li>
  );
}

export default function DealsView({ market: m }: { market: MarketCode }) {
  const cur = MARKETS[m].currency;
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
  const updated = offersGeneratedAt(m);
  const empty = !newDrops.length && !usedDrops.length && !savings.length;
  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Price drops in {MARKETS[m].name}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          From our own daily record of the lowest in-stock price at each retailer: today against a week ago. No sponsored placements.
          {updated ? ` Prices checked ${new Date(updated).toUTCString().slice(5, 16)}.` : ""}
        </p>
      </div>
      {empty && (
        <p className="card p-6 text-sm text-muted">
          Nothing to show yet: price drops appear once we have a week of {MARKETS[m].short} price history. Until then, <Link href={marketPath(m, "/cameras")}>browse cameras</Link> or{" "}
          <Link href={marketPath(m, "/lenses")}>lenses</Link>.
        </p>
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
      <AdSlot slot={AD_SLOTS.listing} />
    </div>
  );
}
