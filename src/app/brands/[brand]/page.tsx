import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CameraCard from "@/components/CameraCard";
import { brand, brands, mounts, publishedCameras } from "@/lib/catalog";

import { summarize } from "@/lib/summary";

export const dynamicParams = false;

export function generateStaticParams() {
  const live = new Set(publishedCameras().map((c) => c.brand));
  return brands().filter((b) => live.has(b.slug)).map((b) => ({ brand: b.slug }));
}

export function generateMetadata({ params }: { params: { brand: string } }): Metadata {
  const b = brand(params.brand);
  if (!b) return {};
  return { title: `${b.name} cameras: prices and specs`, description: `Every ${b.name} camera we track, with today's lowest new and used prices and full specs.`, alternates: { canonical: `/brands/${b.slug}` } };
}

export default function BrandPage({ params }: { params: { brand: string } }) {
  const b = brand(params.brand);
  if (!b) notFound();
  const cams = publishedCameras().filter((c) => c.brand === b.slug);
  // Group by system: one section per mount, fixed-lens cameras last.
  const groups = [...mounts().map((m) => ({ title: m.name, list: cams.filter((c) => c.mount === m.slug) })), { title: "Fixed-lens cameras", list: cams.filter((c) => !c.mount) }].filter((g) => g.list.length);
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-extrabold tracking-tight">{b.name} cameras</h1>
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="h-section mb-3">{g.title}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.list.map((c) => <CameraCard key={c.slug} c={summarize(c)} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
