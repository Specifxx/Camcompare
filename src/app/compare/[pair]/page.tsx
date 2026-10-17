import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import CompareTable from "@/components/CompareTable";
import { comparePairs, isIndexedPair, offersFor, pairSlug, parsePairSlug } from "@/lib/catalog";
import { centsToUsd } from "@/lib/format";
import { breadcrumb, ldJson } from "@/lib/jsonld";
import { lowest } from "@/lib/offers";

import { keyDifferences, sensorLabel } from "@/lib/specs/definitions";

export const dynamicParams = false;

export function generateStaticParams() {
  return comparePairs().map(([a, b]) => ({ pair: pairSlug(a, b) }));
}

export function generateMetadata({ params }: { params: { pair: string } }): Metadata {
  const p = parsePairSlug(params.pair);
  if (!p) return {};
  const [a, b] = p;
  return {
    title: `${a.name} vs ${b.name}: specs and prices compared`,
    description: `${a.name} (${a.specs.megapixels} MP ${sensorLabel(a.specs.sensorFormat)}) against ${b.name} (${b.specs.megapixels} MP ${sensorLabel(b.specs.sensorFormat)}): every spec side by side and today's lowest new and used prices.`,
    alternates: { canonical: `/compare/${pairSlug(a, b)}` },
    ...(isIndexedPair(a, b) ? {} : { robots: { index: false, follow: true } }),
  };
}

export default function PairPage({ params }: { params: { pair: string } }) {
  const p = parsePairSlug(params.pair);
  if (!p) notFound();
  const [a, b] = p;
  if (pairSlug(a, b) !== params.pair) permanentRedirect(`/compare/${pairSlug(a, b)}`);
  const diffs = keyDifferences(a, b);
  const priceLine = (slug: string) => {
    const n = lowest(offersFor(slug), "new");
    const u = lowest(offersFor(slug), "used");
    return [n ? `${centsToUsd(n.priceCents)} new` : null, u ? `${centsToUsd(u.priceCents)} used` : null].filter(Boolean).join(", ");
  };
  const pa = priceLine(a.slug);
  const pb = priceLine(b.slug);
  return (
    <div className="flex flex-col gap-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Compare", path: "/compare" }, { name: `${a.shortName} vs ${b.shortName}`, path: `/compare/${pairSlug(a, b)}` }]))} />
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{a.name} vs {b.name}</h1>
        {(pa || pb) && (
          <p className="mt-2 text-sm text-muted">
            Today: {a.shortName} {pa || "not priced yet"}; {b.shortName} {pb || "not priced yet"}.
          </p>
        )}
      </div>
      {diffs.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-subtle">Key differences</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {diffs.map((d) => <li key={d}>{d}</li>)}
          </ul>
        </section>
      )}
      <CompareTable cameras={[a, b]} />
      <p className="text-sm">
        <Link href={`/compare?c=${a.slug},${b.slug}`}>Add a third camera to this comparison →</Link>
      </p>
    </div>
  );
}
