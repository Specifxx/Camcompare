// /accessories and /accessories/<category>, per market: camera accessories
// (cages, batteries, tripods, film, cards…) from the shops we already price,
// sorted by price. Static like every page: data/accessories/<market>.json.
import type { Metadata } from "next";
import Link from "next/link";
import AccessoryBrowser from "@/components/AccessoryBrowser";
import AdSlot from "@/components/AdSlot";
import PerGbTrend from "@/components/PerGbTrend";
import { accessoryCategory, CATEGORIES, formatLabel, PER_GB_CATEGORIES, SYSTEM_CATEGORIES } from "@/lib/accessories";
import { accessoriesIn, marketAccessories, readAccessoryHistory } from "@/lib/accessory-data";
import { accessoriesIndexable, accessoryRows, cameraNames, categoryIndexable, categorySummaries } from "@/lib/accessory-rows";
import { AD_SLOTS } from "@/lib/ads";
import { price } from "@/lib/format";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { pageMeta } from "@/lib/seo";

const GROUP_LABEL: Record<string, string> = {
  support: "Rigs and support",
  power: "Power",
  media: "Cards, drives, cables and film",
  light: "Lighting",
  audio: "Audio",
  lens: "For your lenses",
  carry: "Carry",
  other: "Everything else",
};
const GROUP_ORDER = ["support", "power", "media", "light", "audio", "lens", "carry", "other"];

export function accessoriesMetadata(m: MarketCode): Metadata {
  return pageMeta({
    title: "Camera accessories: compare prices",
    description: `Camera cages, batteries, grips, L-brackets, tripods, gimbals, memory cards, SSDs, film, flashes and more at camera shops in ${MARKETS[m].name}, cheapest first, with accessory brands side by side.`,
    path: "/accessories",
    market: m,
    index: accessoriesIndexable(m),
    indexable: accessoriesIndexable,
  });
}

export default function AccessoriesView({ market: m }: { market: MarketCode }) {
  const sums = categorySummaries(m);
  const cur = MARKETS[m].currency;
  const updated = marketAccessories(m).generatedAt;
  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Camera accessories in {MARKETS[m].name}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Cages, batteries, tripods, cards, film, lights and more from the camera shops we already check for camera prices, sorted by price. Filter by accessory brand or by the camera it fits, and compare brands side by side. No sponsored placements.
          {updated ? ` Prices checked ${new Date(updated).toUTCString().slice(5, 16)}.` : ""}
        </p>
      </div>
      {!sums.length && (
        <p className="card p-6 text-sm text-muted">
          No accessory listings for {MARKETS[m].name} yet: they appear after the next price check of shops here. Until then, <Link prefetch={false} href={marketPath(m, "/cameras")}>browse cameras</Link>.
        </p>
      )}
      {GROUP_ORDER.map((g) => {
        const list = sums.filter((s) => s.group === g);
        if (!list.length) return null;
        return (
          <section key={g}>
            <h2 className="h-section mb-3">{GROUP_LABEL[g]}</h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((s) => (
                <li key={s.slug}>
                  <Link href={marketPath(m, `/accessories/${s.slug}`)} prefetch={false} className="card flex h-full flex-col gap-1 p-4 text-fg no-underline hover:no-underline">
                    <span className="font-semibold">{s.label}</span>
                    <span className="text-xs text-muted">
                      {s.count} listing{s.count === 1 ? "" : "s"}
                      {s.brands ? ` · ${s.brands} brand${s.brands === 1 ? "" : "s"}` : ""}
                    </span>
                    {s.low !== null && (
                      <span className="price text-sm">
                        {price(s.low, cur)}
                        {s.high !== null && s.high !== s.low ? ` – ${price(s.high, cur)}` : ""}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {sums.length > 0 && <AdSlot slot={AD_SLOTS.listing} />}
    </div>
  );
}

export const accessoryCategoryParams = () => CATEGORIES.map((c) => ({ category: c.slug }));

export function accessoryCategoryMetadata(category: string, m: MarketCode): Metadata {
  const c = accessoryCategory(category);
  if (!c) return {};
  const n = accessoriesIn(m, category).length;
  return pageMeta({
    title: `${c.label}: compare prices and brands`,
    description: `${n ? `${n} ` : ""}${c.label.toLowerCase()} listings at camera shops in ${MARKETS[m].name}, cheapest first${PER_GB_CATEGORIES.has(category) ? ", with price per GB" : ""}. Filter by brand${SYSTEM_CATEGORIES.has(category) ? " and camera system" : " and the camera it fits"}.`,
    path: `/accessories/${category}`,
    market: m,
    index: n > 0,
    indexable: categoryIndexable(category),
  });
}

export function AccessoryCategoryView({ category, market: m }: { category: string; market: MarketCode }) {
  const c = accessoryCategory(category)!;
  const rows = accessoryRows(accessoriesIn(m, category), m, `acc-${m}-${category}`, "list");
  const { cams, brands } = cameraNames(rows, m);
  const perGb = PER_GB_CATEGORIES.has(category);
  const history = perGb ? readAccessoryHistory(m) : [];
  return (
    <div className="flex flex-col gap-8">
      <div>
        <nav className="mb-2 text-xs text-subtle" aria-label="Breadcrumb">
          <Link prefetch={false} href={marketPath(m, "/accessories")}>Accessories</Link> / <span>{c.label}</span>
        </nav>
        <h1 className="text-2xl font-extrabold tracking-tight">{c.label} in {MARKETS[m].name}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {rows.length ? `${rows.length} listings from camera shops we check, cheapest in stock first.` : "Nothing listed here yet."}
          {perGb ? " Capacity and speed are read from each listing's title; price per GB is the price over the stated capacity." : ""}
          {SYSTEM_CATEGORIES.has(category) ? " The system is the camera maker whose TTL the flash or trigger speaks, from its model code (V1-S, X2T-C…) or its title." : ""}
          {" "}A camera is only listed where the title names it with its brand.
        </p>
      </div>
      {perGb && <PerGbTrend history={history} category={category} currency={MARKETS[m].currency} formatName={(f) => formatLabel(category, f) ?? f} />}
      {rows.length > 0 && <AccessoryBrowser rows={rows} cams={cams} cameraBrands={brands} perGb={perGb} system={SYSTEM_CATEGORIES.has(category)} />}
      <p className="text-sm">
        <Link prefetch={false} href={marketPath(m, "/accessories")}>All accessory categories →</Link>
      </p>
      {rows.length > 0 && <AdSlot slot={AD_SLOTS.listing} />}
    </div>
  );
}
