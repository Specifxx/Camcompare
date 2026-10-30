import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { brand as getBrand, brands, mounts, publishedCameras, publishedLenses } from "@/lib/catalog";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { pageMeta } from "@/lib/seo";
import { summarizeCamera, summarizeLens } from "@/lib/summary";
import { typeLabel } from "@/lib/specs/definitions";

export const liveBrands = () => brands().filter((b) => publishedCameras().some((c) => c.brand === b.slug) || publishedLenses().some((l) => l.brand === b.slug));

export function brandsMetadata(m: MarketCode): Metadata {
  return pageMeta({ title: "Camera and lens brands", description: `Every camera and lens maker we track, with prices in ${MARKETS[m].name}.`, path: "/brands", market: m });
}

export function BrandsIndex({ market: m }: { market: MarketCode }) {
  const list = liveBrands().map((b) => ({ ...b, cams: publishedCameras().filter((c) => c.brand === b.slug).length, lenses: publishedLenses().filter((l) => l.brand === b.slug).length }));
  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight">Brands</h1>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((b) => (
          <li key={b.slug}>
            <Link href={marketPath(m, `/brands/${b.slug}`)} className="card flex items-center justify-between p-4 text-fg no-underline hover:border-accent hover:no-underline">
              <span className="font-semibold">{b.name}</span>
              <span className="text-sm text-subtle">{[b.cams ? `${b.cams} cameras` : null, b.lenses ? `${b.lenses} lenses` : null].filter(Boolean).join(" · ")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function brandMetadata(slug: string, m: MarketCode): Metadata {
  const b = getBrand(slug);
  if (!b) return {};
  return pageMeta({ title: `${b.name} cameras and lenses: prices and specs`, description: `Every ${b.name} camera and lens we track, with today's lowest new and used prices in ${MARKETS[m].name}.`, path: `/brands/${b.slug}`, market: m });
}

export default function BrandView({ slug, market: m }: { slug: string; market: MarketCode }) {
  const b = getBrand(slug)!;
  const cams = publishedCameras().filter((c) => c.brand === b.slug);
  const lenses = publishedLenses().filter((l) => l.brand === b.slug);
  const camGroups = [
    ...mounts().map((mt) => ({ title: mt.name, list: cams.filter((c) => c.mount === mt.slug) })),
    ...(["compact", "action", "360", "drone", "smart-glasses"] as const).map((t) => ({ title: t === "smart-glasses" ? typeLabel(t) : `${typeLabel(t)}s`, list: cams.filter((c) => !c.mount && c.type === t) })),
    { title: "Other fixed-lens cameras", list: cams.filter((c) => !c.mount && !["compact", "action", "360", "drone", "smart-glasses"].includes(c.type)) },
  ].filter((g) => g.list.length);
  const lensGroups = mounts().map((mt) => ({ title: `Lenses for ${mt.name}`, list: lenses.filter((l) => l.mounts.includes(mt.slug)) })).filter((g) => g.list.length);
  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{b.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {[cams.length ? `${cams.length} cameras` : null, lenses.length ? `${lenses.length} lenses` : null].filter(Boolean).join(" and ")} · prices for {MARKETS[m].name}
          {b.sublines?.length ? ` · includes ${b.sublines.join(", ")}` : ""}
        </p>
      </div>
      {camGroups.map((g) => (
        <section key={g.title}>
          <h2 className="h-section mb-3">{g.title}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.list.map((c) => (
              <ProductCard key={c.slug} p={summarizeCamera(c, m)} market={m} />
            ))}
          </div>
        </section>
      ))}
      {lensGroups.map((g) => (
        <section key={g.title}>
          <h2 className="h-section mb-3">{g.title}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.list.map((l) => (
              <ProductCard key={l.slug} p={summarizeLens(l, m)} market={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
