// /digicams (and /uk/digicams…): every compact "digicam" in the catalog,
// grouped by sensor size, with today's new and used prices in the market,
// and the older ones people buy used for their look. Static, from the
// catalog and offers files; no data source of its own.
import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { digicamGroups, digicams, DIGICAM_OLD_BEFORE, olderDigicams, pricedIn } from "@/lib/curated";
import { price } from "@/lib/format";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { pageMeta } from "@/lib/seo";
import { summarizeCamera } from "@/lib/summary";

export function digicamsMetadata(m: MarketCode): Metadata {
  return pageMeta({
    title: "Digicams: compact and point-and-shoot cameras",
    description: `Every compact digital camera we track, from the Ricoh GR and Fujifilm X100 to the Sony RX100 and Canon G7 X, with new and used prices in ${MARKETS[m].name}, and the older digicams people buy for the look.`,
    path: "/digicams",
    market: m,
    index: pricedIn(digicams(), m),
    indexable: (x) => pricedIn(digicams(), x),
  });
}

export default function DigicamsView({ market: m }: { market: MarketCode }) {
  const groups = digicamGroups();
  const older = olderDigicams(m).slice(0, 12);
  const cur = MARKETS[m].currency;
  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-extrabold tracking-tight">Digicams</h1>
        <p className="mt-2 text-sm text-muted">
          Compact digital cameras with the lens built in: pocket point-and-shoots, the premium 1-inch classics and large-sensor street cameras. They&apos;re back, partly
          for the look: a flash-lit, slightly imperfect picture that doesn&apos;t look like a phone. Prices are today&apos;s cheapest at the stores we track in{" "}
          {MARKETS[m].name}, new and used. See also <Link href={marketPath(m, "/viral-cameras")} prefetch={false}>viral cameras right now</Link>.
        </p>
        <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="On this page">
          {groups.map((g) => (
            <a key={g.id} href={`#${g.id}`}>
              {g.title} ({g.cameras.length})
            </a>
          ))}
          {older.length > 0 && <a href="#older">Older digicams, used</a>}
        </nav>
      </header>
      {older.length > 0 && (
        <section id="older" aria-labelledby="older-h">
          <h2 id="older-h" className="h-section">
            Older digicams, used
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">Compacts from before {DIGICAM_OLD_BEFORE} with a used listing today, cheapest first: the way into the digicam look without paying for a new one.</p>
          <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
            {older.map(({ camera: c, used }) => (
              <li key={c.slug} className="flex items-baseline justify-between gap-3 py-2">
                <Link href={marketPath(m, `/cameras/${c.slug}`)} prefetch={false}>
                  {c.name}
                </Link>
                <span className="shrink-0 text-xs text-subtle">
                  {c.announced.slice(0, 4)} · used from <span className="price text-sm font-semibold text-fg">{price(used, cur)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {groups.map((g) => (
        <section key={g.id} id={g.id} aria-labelledby={`${g.id}-h`}>
          <h2 id={`${g.id}-h`} className="h-section">
            {g.title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">{g.blurb}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.cameras.map((c) => (
              <ProductCard key={c.slug} p={summarizeCamera(c, m)} market={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
