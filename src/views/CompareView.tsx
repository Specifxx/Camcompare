import type { Metadata } from "next";
import Link from "next/link";
import CompareTable from "@/components/CompareTable";
import ComparePicker from "@/components/ComparePicker";
import SizeCompare from "@/components/SizeCompare";
import { brandName, displayName, displayShortName, indexedPairs, pairSlug, product, publishedCameras, publishedLenses, type AnyProduct } from "@/lib/catalog";
import type { Camera } from "@/lib/catalog/schema";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";

// Any combination a visitor builds. Not indexed: the indexed comparisons are
// the curated rival pairs under /compare/<a>-vs-<b>.
export function compareMetadata(m: MarketCode): Metadata {
  return {
    title: "Compare cameras and lenses side by side",
    description: `Pick up to four cameras or lenses and compare every spec and today's lowest price in ${MARKETS[m].name}.`,
    robots: { index: false, follow: true },
    alternates: { canonical: marketPath(m, "/compare") },
  };
}

export default function CompareView({ market: m, c }: { market: MarketCode; c?: string }) {
  const slugs = [...new Set((c ?? "").split(",").filter(Boolean))].slice(0, 4);
  const found = slugs.map((s) => product(s)).filter((x): x is AnyProduct => x !== null);
  const kind = found[0]?.kind;
  const chosen = found.filter((p) => p.kind === kind);
  const pool = kind === "lens" ? publishedLenses() : kind === "camera" ? publishedCameras() : [...publishedCameras(), ...publishedLenses()];
  const options = pool.map((p) => ({ slug: p.slug, label: `${brandName(p.brand)} ${displayShortName(p, m)}` })).sort((a, b) => a.label.localeCompare(b.label));
  const base = marketPath(m, "/compare");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Compare {kind === "lens" ? "lenses" : kind === "camera" ? "cameras" : "cameras or lenses"}</h1>
        <p className="mt-1 text-sm text-muted">Up to four at a time, prices for {MARKETS[m].name}.{found.length > chosen.length ? " Cameras and lenses can't be compared with each other, so the others were left out." : ""}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {chosen.map((p) => (
          <Link key={p.item.slug} href={`${base}?c=${chosen.filter((x) => x !== p).map((x) => x.item.slug).join(",")}`} prefetch={false} className="chip no-underline hover:no-underline" aria-label={`Remove ${p.item.name}`}>
            {displayName(p.item, m)} ✕
          </Link>
        ))}
        <ComparePicker base={base} options={options} current={chosen.map((p) => p.item.slug)} />
      </div>
      {chosen.length >= 1 ? (
        <>
          <CompareTable items={chosen} market={m} />
          {kind === "camera" && chosen.length >= 2 && (
            <section>
              <h2 className="h-section mb-3">Size, to scale</h2>
              <SizeCompare cameras={chosen.map((p) => p.item as Camera)} />
            </section>
          )}
        </>
      ) : (
        <section>
          <h2 className="h-section mb-3">Popular comparisons</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {indexedPairs().slice(0, 45).map(([a, b]) => (
              <li key={pairSlug(a.item, b.item)}>
                <Link prefetch={false} href={`/compare/${pairSlug(a.item, b.item)}`}>
                  {a.item.name} vs {b.item.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
