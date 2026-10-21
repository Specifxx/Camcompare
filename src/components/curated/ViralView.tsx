// /viral-cameras (and /uk/viral-cameras…): the cameras everyone wants right
// now, from the owner's list in data/viral.json, with today's prices and
// stock in the market: a backorder or pre-order note where a store's
// listing says so. Static, from the catalog and offers files.
import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { availabilityOf, pricedIn, readViral, viralCameras } from "@/lib/curated";
import { offersFor } from "@/lib/catalog";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { retailer } from "@/lib/retailers";
import { pageMeta } from "@/lib/seo";
import { summarizeCamera } from "@/lib/summary";

const cams = () => viralCameras().map((v) => v.camera);

export function viralMetadata(m: MarketCode): Metadata {
  return pageMeta({
    title: "Viral cameras right now",
    description: `The cameras everyone is after: Ricoh GR, Fujifilm X100VI, Canon G7 X III, Sony ZV-1, DJI Osmo Pocket and Insta360, with prices and stock in ${MARKETS[m].name}.`,
    path: "/viral-cameras",
    market: m,
    index: pricedIn(cams(), m),
    indexable: (x) => pricedIn(cams(), x),
  });
}

export default function ViralView({ market: m }: { market: MarketCode }) {
  const list = viralCameras();
  const { updated } = readViral();
  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-extrabold tracking-tight">Viral cameras right now</h1>
        <p className="mt-2 text-sm text-muted">
          The cameras all over social feeds, and often hard to buy: the pocket street cameras, film-look compacts and vlogging and action cameras people are asking
          about. Today&apos;s cheapest new and used prices in {MARKETS[m].name}, and where stores list them as backordered. Picked by us, updated {updated}. More compacts:{" "}
          <Link href={marketPath(m, "/digicams")} prefetch={false}>digicams</Link>.
        </p>
      </header>
      <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(({ camera: c, why }, i) => {
          const a = availabilityOf(offersFor(c.slug, m), (id) => retailer(id)?.name ?? id);
          return (
            <li key={c.slug} className="flex flex-col gap-2">
              <p className="text-sm">
                <span className="price mr-1 font-semibold text-accent">{i + 1}.</span>
                {why}
              </p>
              <div className="flex-1">
                <ProductCard p={summarizeCamera(c, m)} market={m} />
              </div>
              <p className={`text-xs ${a.backorder.length || a.preorder.length || !a.inStock ? "font-semibold text-warn" : "text-win"}`}>
                {a.note ?? `In stock at ${a.inStock} store${a.inStock === 1 ? "" : "s"}`}
              </p>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-subtle">Prices and stock come from the stores&apos; own listings, refreshed every few hours; Amazon&apos;s prices show on each product page only.</p>
    </div>
  );
}
