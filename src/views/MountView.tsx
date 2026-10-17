import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { brandName, mount as getMount, mounts, publishedCameras, publishedLenses } from "@/lib/catalog";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { pageMeta } from "@/lib/seo";
import { sensorLabel } from "@/lib/specs/definitions";
import { summarizeCamera, summarizeLens } from "@/lib/summary";

export const liveMounts = () => mounts().filter((mt) => publishedCameras().some((c) => c.mount === mt.slug) || publishedLenses().some((l) => l.mounts.includes(mt.slug)));

export function mountMetadata(slug: string, m: MarketCode): Metadata {
  const mt = getMount(slug);
  if (!mt) return {};
  return pageMeta({
    title: `${mt.name} cameras and lenses`,
    description: `The ${mt.name} system: every camera body and lens we track for it, native and third-party, with prices in ${MARKETS[m].name}.`,
    path: `/mounts/${mt.slug}`,
    market: m,
  });
}

export default function MountView({ slug, market: m }: { slug: string; market: MarketCode }) {
  const mt = getMount(slug)!;
  const bodies = publishedCameras().filter((c) => c.mount === mt.slug);
  const lenses = publishedLenses().filter((l) => l.mounts.includes(mt.slug));
  const makers = [...new Set(lenses.map((l) => l.brand))].sort((a, b) => Number(b === mt.brand) - Number(a === mt.brand) || a.localeCompare(b));
  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{mt.name}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {mt.brand ? `${brandName(mt.brand)}'s` : "An alliance"} mount, introduced in {mt.introduced}, flange distance {mt.flangeMm} mm, for {mt.formats.map((f) => sensorLabel(f)).join(" and ")} sensors{mt.status === "legacy" ? "; no longer developed" : ""}. {bodies.length} bodies and {lenses.length} lenses here.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link prefetch={false} href={marketPath(m, `/cameras?mount=${mt.slug}`)} className="btn-ghost">Filter cameras</Link>
          <Link prefetch={false} href={marketPath(m, `/lenses?mount=${mt.slug}`)} className="btn-ghost">Filter lenses</Link>
        </div>
      </div>
      {bodies.length > 0 && (
        <section>
          <h2 className="h-section mb-3">Camera bodies</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {bodies.map((c) => (
              <ProductCard key={c.slug} p={summarizeCamera(c, m)} market={m} />
            ))}
          </div>
        </section>
      )}
      {makers.map((b) => (
        <section key={b}>
          <h2 className="h-section mb-3">{brandName(b)} lenses</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {lenses.filter((l) => l.brand === b).map((l) => (
              <ProductCard key={l.slug} p={summarizeLens(l, m)} market={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function mountsMetadata(m: MarketCode): Metadata {
  return pageMeta({ title: "Camera systems and lens mounts", description: `Every lens mount we track, with its bodies and lenses and prices in ${MARKETS[m].name}.`, path: "/mounts", market: m });
}

export function MountsIndex({ market: m }: { market: MarketCode }) {
  const list = liveMounts().map((mt) => ({ mt, bodies: publishedCameras().filter((c) => c.mount === mt.slug).length, lenses: publishedLenses().filter((l) => l.mounts.includes(mt.slug)).length }));
  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight">Camera systems</h1>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(({ mt, bodies, lenses }) => (
          <li key={mt.slug}>
            <Link prefetch={false} href={marketPath(m, `/mounts/${mt.slug}`)} className="card flex flex-col p-4 text-fg no-underline hover:border-accent hover:no-underline">
              <span className="font-semibold">{mt.name}</span>
              <span className="text-sm text-subtle">
                {mt.formats.map((f) => sensorLabel(f)).join(" / ")} · {bodies} bodies · {lenses} lenses{mt.status === "legacy" ? " · legacy" : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
