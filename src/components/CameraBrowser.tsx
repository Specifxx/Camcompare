"use client";
// The /cameras finder. The whole published catalog is a few hundred small
// records, so filtering happens in the browser: no API, no database.
import Link from "next/link";
import { useMemo, useState } from "react";
import type { CameraSummary } from "@/lib/summary";
import CameraCard from "./CameraCard";

const SENSORS: [CameraSummary["sensor"], string][] = [
  ["medium-format", "Medium format"],
  ["full-frame", "Full frame"],
  ["aps-c", "APS-C"],
  ["micro-four-thirds", "Micro Four Thirds"],
  ["1-inch", '1.4" and smaller'],
];
const TYPES: [CameraSummary["type"], string][] = [
  ["mirrorless", "Mirrorless"],
  ["dslr", "DSLR"],
  ["compact", "Compact"],
  ["medium-format", "Medium format"],
  ["rangefinder", "Rangefinder"],
];
const SORTS = {
  newest: { label: "Newest", fn: (a: CameraSummary, b: CameraSummary) => b.announced.localeCompare(a.announced) },
  price: { label: "Price: low to high", fn: (a: CameraSummary, b: CameraSummary) => (priceOf(a) ?? Infinity) - (priceOf(b) ?? Infinity) },
  mp: { label: "Resolution", fn: (a: CameraSummary, b: CameraSummary) => b.megapixels - a.megapixels },
  weight: { label: "Lightest", fn: (a: CameraSummary, b: CameraSummary) => (a.weightG ?? Infinity) - (b.weightG ?? Infinity) },
};

/** Today's lowest price, else the launch price: what "under $X" filters on. */
const priceOf = (c: CameraSummary) => (c.lowestNewCents ?? c.lowestUsedCents ?? null) !== null ? (c.lowestNewCents ?? c.lowestUsedCents)! / 100 : c.launchPriceUsd;
const smallSensor = (s: CameraSummary["sensor"]) => s === "1.4-inch" || s === "1-inch" || s === "1/1.3-inch" || s === "1/2.3-inch";

export default function CameraBrowser({ cameras, brands }: { cameras: CameraSummary[]; brands: { slug: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState<string[]>([]);
  const [sensor, setSensor] = useState<string[]>([]);
  const [type, setType] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [fromYear, setFromYear] = useState<number | null>(null);
  const [ibis, setIbis] = useState(false);
  const [sealed, setSealed] = useState(false);
  const [sort, setSort] = useState<keyof typeof SORTS>("newest");
  const [picked, setPicked] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false); // phones only: the sidebar is always open on desktop

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/α/g, "a");
    return cameras
      .filter((c) => !needle || `${c.brandName} ${c.name}`.toLowerCase().replace(/α/g, "a").includes(needle))
      .filter((c) => !brand.length || brand.includes(c.brand))
      .filter((c) => !sensor.length || sensor.includes(c.sensor) || (sensor.includes("1-inch") && smallSensor(c.sensor)))
      .filter((c) => !type.length || type.includes(c.type))
      .filter((c) => maxPrice === null || (priceOf(c) ?? Infinity) <= maxPrice)
      .filter((c) => fromYear === null || Number(c.announced.slice(0, 4)) >= fromYear)
      .filter((c) => !ibis || c.ibis)
      .filter((c) => !sealed || c.weatherSealed)
      .sort(SORTS[sort].fn);
  }, [cameras, q, brand, sensor, type, maxPrice, fromYear, ibis, sealed, sort]);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const pick = (slug: string) => setPicked((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : p.length >= 4 ? p : [...p, slug]));

  const Checks = ({ title, options, value, set }: { title: string; options: [string, string][]; value: string[]; set: (v: string[]) => void }) => (
    <fieldset>
      <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-subtle">{title}</legend>
      {options.map(([v, label]) => (
        <label key={v} className="flex cursor-pointer items-center gap-2 py-0.5 text-sm">
          <input type="checkbox" checked={value.includes(v)} onChange={() => toggle(value, set, v)} className="h-4 w-4" />
          {label}
        </label>
      ))}
    </fieldset>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="flex flex-col gap-5">
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cameras" aria-label="Search cameras" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
          <button type="button" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} className="btn-ghost lg:hidden">
            Filters
          </button>
        </div>
        <div className={`${filtersOpen ? "flex" : "hidden"} flex-col gap-5 lg:flex`}>
          <Checks title="Brand" options={brands.map((b) => [b.slug, b.name])} value={brand} set={setBrand} />
          <Checks title="Sensor" options={SENSORS} value={sensor} set={setSensor} />
          <Checks title="Type" options={TYPES} value={type} set={setType} />
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-subtle">Features</legend>
            <label className="flex items-center gap-2"><input type="checkbox" checked={ibis} onChange={(e) => setIbis(e.target.checked)} className="h-4 w-4" />In-body stabilisation</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={sealed} onChange={(e) => setSealed(e.target.checked)} className="h-4 w-4" />Weather sealed</label>
          </fieldset>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-subtle">Budget</span>
            <select value={maxPrice ?? ""} onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : null)} className="w-full rounded-lg border border-line bg-surface px-2 py-1.5">
              <option value="">Any price</option>
              {[500, 800, 1000, 1500, 2000, 3000, 5000].map((p) => <option key={p} value={p}>Under ${p.toLocaleString("en-US")}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-subtle">Announced</span>
            <select value={fromYear ?? ""} onChange={(e) => setFromYear(e.target.value ? Number(e.target.value) : null)} className="w-full rounded-lg border border-line bg-surface px-2 py-1.5">
              <option value="">Any year</option>
              {[2025, 2024, 2023, 2022, 2020, 2018].map((y) => <option key={y} value={y}>{y} or later</option>)}
            </select>
          </label>
        </div>
      </aside>
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted">{shown.length} camera{shown.length === 1 ? "" : "s"}</p>
          <label className="flex items-center gap-2">
            <span className="text-subtle">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)} className="rounded-lg border border-line bg-surface px-2 py-1.5">
              {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {shown.map((c) => (
            <div key={c.slug} className="relative">
              <CameraCard c={c} />
              <label className="absolute right-2 top-2 flex cursor-pointer items-center gap-1 rounded-md border border-line bg-surface/95 px-1.5 py-0.5 text-[11px] font-medium">
                <input type="checkbox" checked={picked.includes(c.slug)} onChange={() => pick(c.slug)} className="h-3.5 w-3.5" />
                Compare
              </label>
            </div>
          ))}
        </div>
      </section>
      {picked.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 text-sm">
            <p className="truncate text-muted">
              {picked.map((s) => cameras.find((c) => c.slug === s)?.shortName).join(" · ")}
              <span className="ml-2 text-subtle">({picked.length}/4)</span>
            </p>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => setPicked([])} className="btn-ghost">Clear</button>
              {picked.length >= 2 ? <Link href={`/compare?c=${picked.join(",")}`} className="btn-primary">Compare {picked.length}</Link> : <span className="btn-ghost opacity-60">Pick one more</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
