// /cameras/type/<type> and /cameras/sensor/<sensor> (and each market's copy): see lib/hubs.ts.
import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { price } from "@/lib/format";
import { hubData, hubFacts, hubFor, hubPath, hubIndexable, hubsOf, liveHubs, HUB_INDEX_MIN, type HubKind } from "@/lib/hubs";
import { breadcrumb, ldJson } from "@/lib/jsonld";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { pageMeta } from "@/lib/seo";

export const isHub = (kind: HubKind, key: string) => hubFor(kind, key) !== undefined;
export const hubKeys = (kind: HubKind) => hubsOf(kind).map((h) => h.key);

export function metadataForHub(kind: HubKind, key: string, m: MarketCode): Metadata {
  const h = hubFor(kind, key);
  if (!h) return {};
  const d = hubData(h, m);
  const cur = MARKETS[m].currency;
  const name = h.noun.charAt(0).toUpperCase() + h.noun.slice(1);
  const from = d.cheapest?.lowestNew != null ? ` from ${price(d.cheapest.lowestNew, cur)}` : "";
  return pageMeta({
    title: `${name}: ${d.cameras.length} models${from}`,
    description: `${d.cameras.length} ${h.noun} with today's new and used prices at the stores we track in ${MARKETS[m].name}, cheapest first. ${h.blurb}`,
    path: hubPath(h),
    market: m,
    index: d.cameras.length >= HUB_INDEX_MIN,
    indexable: (x) => hubIndexable(h, x),
  });
}

export default function HubView({ kind, hubKey, market: m }: { kind: HubKind; hubKey: string; market: MarketCode }) {
  const h = hubFor(kind, hubKey);
  if (!h) return null;
  const d = hubData(h, m);
  const name = h.noun.charAt(0).toUpperCase() + h.noun.slice(1);
  const others = liveHubs(kind, m).filter((x) => x.key !== h.key);
  const ld = breadcrumb([
    { name: "Home", path: marketPath(m, "/") },
    { name: "Cameras", path: marketPath(m, "/cameras") },
    { name: name, path: marketPath(m, hubPath(h)) },
  ]);
  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-extrabold tracking-tight">{name}: prices at {MARKETS[m].name} stores</h1>
        <p className="mt-2 text-sm text-muted">
          {h.blurb} {hubFacts(h, d, m)} Cheapest first, no paid placement. Want to filter by budget or brand?{" "}
          <Link href={marketPath(m, "/cameras")} prefetch={false}>
            Browse all cameras
          </Link>
          .
        </p>
        {others.length > 0 && (
          <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label={kind === "type" ? "Other camera types" : "Other sensor sizes"}>
            {others.map((x) => (
              <Link key={x.key} href={marketPath(m, hubPath(x))} prefetch={false}>
                {x.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <section aria-labelledby="hub-list-h">
        <h2 id="hub-list-h" className="h-section">
          All {h.noun}, cheapest first
        </h2>
        {d.cameras.length ? (
          <ol className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {d.cameras.map((c) => (
              <li key={c.slug}>
                <ProductCard p={c} market={m} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-muted">No {h.noun} are priced in {MARKETS[m].name} today.</p>
        )}
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(ld)} />
    </div>
  );
}
