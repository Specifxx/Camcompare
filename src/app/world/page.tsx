import type { Metadata } from "next";
import Link from "next/link";
import { WorldCaveats, WorldIntro, WorldLineSection } from "@/components/world/WorldSections";
import { worldBrandName, worldBrands, worldLine, worldLinesOf, worldTable } from "@/lib/world";

export const metadata: Metadata = {
  title: "Camera and lens prices around the world",
  description: "US list prices against today's lowest new prices in the UK, Europe, Australia and Singapore, converted into one currency, by product line: Sony G Master, Canon L, Nikon S-Line, Fujifilm GF, DJI and more.",
  alternates: { canonical: "/world" },
};

export default function WorldIndex() {
  const featured = worldLine("sony", "g-master")!;
  return (
    <div className="flex flex-col gap-6">
      <WorldIntro title="Prices around the world" lead="The same lens or camera costs very different amounts in different countries. Each table puts the US list price beside today's lowest new price in every market we track, converted into the currency you pick, with the cheapest in green." />
      <nav aria-label="Product lines" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {worldBrands().map((b) => (
          <div key={b} className="card p-3">
            <h2 className="font-bold">
              <Link href={`/world/${b}`} className="text-fg">
                {worldBrandName(b)}
              </Link>
            </h2>
            <ul className="mt-1 text-sm">
              {worldLinesOf(b).map((l) => {
                const d = worldTable(l);
                return d.rows.length ? (
                  <li key={l.slug}>
                    <Link href={`/world/${b}/${l.slug}`}>{l.name}</Link> <span className="text-xs text-subtle">({d.priced}/{d.rows.length} priced)</span>
                  </li>
                ) : null;
              })}
            </ul>
          </div>
        ))}
      </nav>
      <WorldLineSection line={featured} />
      <WorldCaveats />
    </div>
  );
}
