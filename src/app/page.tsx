import Link from "next/link";
import CameraCard from "@/components/CameraCard";
import CameraThumb from "@/components/CameraThumb";
import { brands, indexedPairs, pairSlug, publishedCameras } from "@/lib/catalog";

import type { Camera } from "@/lib/catalog/schema";
import { summarize } from "@/lib/summary";


export default function Home() {
  const cameras = publishedCameras();
  const latest = cameras.slice(0, 8).map(summarize);
  // Pairs with the newest camera first, so the homepage shows current cross-shops.
  const newest = ([a, b]: [Camera, Camera]) => (a.announced > b.announced ? a.announced : b.announced);
  const pairs = indexedPairs()
    .sort((p, q) => newest(q).localeCompare(newest(p)))
    .slice(0, 9);
  const live = brands().filter((b) => cameras.some((c) => c.brand === b.slug));
  return (
    <div className="flex flex-col gap-10">
      <section className="pt-4">
        <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">Find the right camera, then the lowest price for it.</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Spec sheets side by side for {cameras.length} cameras from {live.length} makers, with new and used prices from US retailers in one table.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/cameras" className="btn-primary">Browse cameras</Link>
          <Link href="/compare" className="btn-ghost">Compare cameras</Link>
        </div>
      </section>

      {pairs.length > 0 && (
        <section>
          <h2 className="h-section mb-3">Popular comparisons</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pairs.map(([a, b]) => (
              <Link key={pairSlug(a, b)} href={`/compare/${pairSlug(a, b)}`} className="card flex items-center gap-3 p-3 text-fg no-underline hover:border-accent hover:no-underline">
                <CameraThumb slug={a.slug} alt="" className="w-20 shrink-0" />
                <span className="flex-1 text-center text-sm font-semibold leading-tight">
                  {a.shortName} <span className="text-subtle">vs</span> {b.shortName}
                </span>
                <CameraThumb slug={b.slug} alt="" className="w-20 shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="h-section">Newest cameras</h2>
          <Link href="/cameras" className="text-sm">All cameras →</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {latest.map((c) => <CameraCard key={c.slug} c={c} />)}
        </div>
      </section>

      <section>
        <h2 className="h-section mb-3">Shop by brand</h2>
        <div className="flex flex-wrap gap-2">
          {live.map((b) => <Link key={b.slug} href={`/brands/${b.slug}`} className="btn-ghost">{b.name}</Link>)}
        </div>
      </section>
    </div>
  );
}
