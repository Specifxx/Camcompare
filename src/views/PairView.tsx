import type { Metadata } from "next";
import { FollowLink } from "@/components/ComparePrices";
import CompareTable from "@/components/CompareTable";
import SizeCompare from "@/components/SizeCompare";
import { isIndexedPair, pairSlug, parsePairSlug } from "@/lib/catalog";
import type { Camera, Lens } from "@/lib/catalog/schema";
import { breadcrumb, ldJson } from "@/lib/jsonld";
import { SPEC_GROUPS, keyDifferences, sensorLabel } from "@/lib/specs/definitions";
import { LENS_SPEC_GROUPS, apertureLabel, focalLabel } from "@/lib/specs/lens";

// One URL per pair for every market: the specs don't change by country.
// Prices are server-rendered for the US and switch to the visitor's market in
// the browser (ComparePrices); so does the link to the builder (FollowLink).

export function pairMetadata(pair: string): Metadata {
  const p = parsePairSlug(pair);
  if (!p) return {};
  const [a, b] = p;
  const blurb = (x: typeof a) =>
    x.kind === "camera" ? `${(x.item as Camera).specs.megapixels} MP ${sensorLabel((x.item as Camera).specs.sensorFormat)}` : `${focalLabel(x.item as Lens)} ${apertureLabel(x.item as Lens)}`;
  return {
    title: `${a.item.name} vs ${b.item.name}: specs and prices compared`,
    description: `${a.item.name} (${blurb(a)}) against ${b.item.name} (${blurb(b)}): every spec side by side, the key differences, and today's lowest new and used prices.`,
    alternates: { canonical: `/compare/${pairSlug(a.item, b.item)}` },
    ...(isIndexedPair(a, b) ? {} : { robots: { index: false, follow: true } }),
  };
}

export default function PairView({ pair }: { pair: string }) {
  const [a, b] = parsePairSlug(pair)!;
  const diffs =
    a.kind === "camera" ? keyDifferences(a.item as Camera, b.item as Camera, SPEC_GROUPS) : keyDifferences(a.item as Lens, b.item as Lens, LENS_SPEC_GROUPS);
  return (
    <div className="flex flex-col gap-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Compare", path: "/compare" }, { name: `${a.item.shortName} vs ${b.item.shortName}`, path: `/compare/${pair}` }]))} />
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {a.item.name} vs {b.item.name}
        </h1>
        <p className="mt-1 text-sm text-muted">Every published spec side by side, with today&apos;s lowest prices for the market you&apos;ve chosen.</p>
      </div>
      {diffs.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-subtle">Key differences</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {diffs.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>
      )}
      <CompareTable items={[a, b]} market="us" followVisitorMarket />
      {a.kind === "camera" && (
        <section>
          <h2 className="h-section mb-3">Size, to scale</h2>
          <SizeCompare cameras={[a.item as Camera, b.item as Camera]} />
        </section>
      )}
      <p className="text-sm">
        <FollowLink path={`/compare?c=${a.item.slug},${b.item.slug}`}>Add a third to this comparison →</FollowLink>
      </p>
    </div>
  );
}
