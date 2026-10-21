import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorldCaveats, WorldIntro, WorldLineSection } from "@/components/world/WorldSections";
import { worldBrandName, worldBrands, worldLinesOf, worldTable } from "@/lib/world";

// Static: catalog and offers are files, read at build (no revalidate).
export const dynamicParams = false;
export const generateStaticParams = () => worldBrands().map((brand) => ({ brand }));

const priced = (brand: string) => worldLinesOf(brand).some((l) => worldTable(l).priced > 0);

export function generateMetadata({ params }: { params: { brand: string } }): Metadata {
  const b = worldBrandName(params.brand);
  return {
    title: `${b} prices around the world`,
    description: `${b} US list prices against today's lowest new prices in the UK, Europe, Australia and Singapore, converted into one currency, line by line.`,
    alternates: { canonical: `/world/${params.brand}` },
    ...(priced(params.brand) ? {} : { robots: { index: false, follow: true } }),
  };
}

export default function WorldBrand({ params }: { params: { brand: string } }) {
  const lines = worldLinesOf(params.brand);
  if (!lines.length) notFound();
  const b = worldBrandName(params.brand);
  return (
    <div className="flex flex-col gap-8">
      <WorldIntro title={`${b}: global price comparison`} lead={`Every ${b} line we track: the US list price beside today's lowest new price in each market, converted into the currency you pick. Green is the cheapest.`} />
      {lines.map((l) => (
        <WorldLineSection key={l.slug} line={l} />
      ))}
      <WorldCaveats />
    </div>
  );
}
