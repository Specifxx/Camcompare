import type { Metadata } from "next";
import Link from "next/link";
import CompareTable from "@/components/CompareTable";
import ComparePicker from "@/components/ComparePicker";
import { brandName, camera, comparePairs, pairSlug, publishedCameras } from "@/lib/catalog";
import type { Camera } from "@/lib/catalog/schema";

// Any combination a visitor builds. Not indexed: the indexed comparisons are
// the curated rival pairs under /compare/[pair].
export const metadata: Metadata = {
  title: "Compare cameras side by side",
  description: "Pick up to four cameras and compare every spec and today's lowest price side by side.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/compare" },
};

export default function ComparePage({ searchParams }: { searchParams: { c?: string } }) {
  const slugs = [...new Set((searchParams.c ?? "").split(",").filter(Boolean))].slice(0, 4);
  const chosen = slugs.map((s) => camera(s)).filter((x): x is Camera => x !== null);
  const options = publishedCameras()
    .map((c) => ({ slug: c.slug, label: `${brandName(c.brand)} ${c.shortName}` }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Compare cameras</h1>
        <p className="mt-1 text-sm text-muted">Up to four at a time. Remove one by editing the list below.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {chosen.map((c) => (
          <Link key={c.slug} href={`/compare?c=${chosen.filter((x) => x !== c).map((x) => x.slug).join(",")}`} className="chip no-underline hover:no-underline" aria-label={`Remove ${c.name}`}>
            {c.name} ✕
          </Link>
        ))}
        <ComparePicker options={options} current={chosen.map((c) => c.slug)} />
      </div>
      {chosen.length >= 1 ? (
        <CompareTable cameras={chosen} />
      ) : (
        <section>
          <h2 className="h-section mb-3">Popular comparisons</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {comparePairs().slice(0, 24).map(([a, b]) => (
              <li key={pairSlug(a, b)}><Link href={`/compare/${pairSlug(a, b)}`}>{a.name} vs {b.name}</Link></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
