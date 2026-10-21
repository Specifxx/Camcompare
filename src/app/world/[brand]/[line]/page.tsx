import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WorldCaveats, WorldIntro, WorldLineSection } from "@/components/world/WorldSections";
import { worldBrandName, worldLine, worldLinesOf, WORLD_LINES, worldTable } from "@/lib/world";

// Static: catalog and offers are files, read at build (no revalidate).
export const dynamicParams = false;
export const generateStaticParams = () => WORLD_LINES.map((l) => ({ brand: l.brand, line: l.slug }));

export function generateMetadata({ params }: { params: { brand: string; line: string } }): Metadata {
  const l = worldLine(params.brand, params.line);
  if (!l) return {};
  const d = worldTable(l);
  const title = `${worldBrandName(l.brand)} ${l.name}: global price comparison`;
  return {
    title,
    description: `${d.rows.length} ${worldBrandName(l.brand)} ${l.name.toLowerCase()}: US list price against today's lowest new price in the UK, Europe, Australia and Singapore, converted into one currency, with the biggest saving.`,
    alternates: { canonical: `/world/${l.brand}/${l.slug}` },
    ...(d.priced > 0 ? {} : { robots: { index: false, follow: true } }),
  };
}

export default function WorldLinePage({ params }: { params: { brand: string; line: string } }) {
  const l = worldLine(params.brand, params.line);
  if (!l) notFound();
  const b = worldBrandName(l.brand);
  const d = worldTable(l);
  return (
    <div className="flex flex-col gap-6">
      <nav className="text-xs text-subtle">
        <Link href="/world">Prices around the world</Link> › <Link href={`/world/${l.brand}`}>{b}</Link>
      </nav>
      <WorldIntro title={`${b} ${l.name}: global price comparison`} lead={`${d.rows.length} products. US list price against today's lowest advertised new price in each market, converted into the currency you pick. Green is the cheapest; the last column is the most you'd save against the US list.`} />
      <WorldLineSection line={l} />
      {worldLinesOf(l.brand).length > 1 && (
        <p className="text-sm">
          More {b}:{" "}
          {worldLinesOf(l.brand)
            .filter((x) => x.slug !== l.slug)
            .map((x, i) => (
              <span key={x.slug}>
                {i ? " · " : ""}
                <Link href={`/world/${x.brand}/${x.slug}`}>{x.name}</Link>
              </span>
            ))}
        </p>
      )}
      <WorldCaveats />
    </div>
  );
}
