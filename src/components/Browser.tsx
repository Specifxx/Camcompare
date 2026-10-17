"use client";
// The /cameras and /lenses finders. The whole published catalog is a few
// hundred small records per kind, so filtering happens in the browser: no
// API, no database. Filters can be preset from the URL (?mount=sony-e&brand=sigma).
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { marketPath, type MarketCode } from "@/lib/markets";
import { priceOf, type CameraSummary, type LensSummary, type ProductSummary } from "@/lib/summary-types";
import ProductCard from "./ProductCard";

type Opt = [string, string];
type Props =
  | { kind: "camera"; items: CameraSummary[]; brands: Opt[]; mounts: Opt[]; market: MarketCode }
  | { kind: "lens"; items: LensSummary[]; brands: Opt[]; mounts: Opt[]; market: MarketCode };

const SENSORS: Opt[] = [
  ["medium-format", "Medium format"],
  ["full-frame", "Full frame"],
  ["aps-c", "APS-C / Super 35"],
  ["micro-four-thirds", "Micro Four Thirds"],
  ["small", "1.4\" and smaller"],
];
const TYPES: Opt[] = [
  ["mirrorless", "Mirrorless"],
  ["dslr", "DSLR"],
  ["compact", "Compact"],
  ["medium-format", "Medium format"],
  ["rangefinder", "Rangefinder"],
  ["action", "Action"],
  ["360", "360°"],
  ["cinema", "Cinema"],
];
const LENS_CATS: Opt[] = [
  ["ultra-wide", "Ultra-wide"],
  ["wide", "Wide"],
  ["standard", "Standard"],
  ["telephoto", "Telephoto"],
  ["super-telephoto", "Super-telephoto"],
  ["macro", "Macro"],
];
const COVERAGE: Opt[] = [
  ["full-frame", "Full frame"],
  ["aps-c", "APS-C"],
  ["micro-four-thirds", "Micro Four Thirds"],
  ["medium-format", "Medium format"],
];

const sensorGroup = (s: CameraSummary["sensor"]) => (s === "super-35" ? "aps-c" : s === "aps-h" ? "full-frame" : ["medium-format", "full-frame", "aps-c", "micro-four-thirds"].includes(s) ? s : "small");

type SortKey = "newest" | "price" | "weight" | "mp" | "aperture" | "focal";
const SORTS: Record<SortKey, { label: string; kinds: ("camera" | "lens")[]; fn: (a: ProductSummary, b: ProductSummary) => number }> = {
  newest: { label: "Newest", kinds: ["camera", "lens"], fn: (a, b) => b.announced.localeCompare(a.announced) },
  price: { label: "Price: low to high", kinds: ["camera", "lens"], fn: (a, b) => (priceOf(a) ?? Infinity) - (priceOf(b) ?? Infinity) },
  weight: { label: "Lightest", kinds: ["camera", "lens"], fn: (a, b) => (a.weightG ?? Infinity) - (b.weightG ?? Infinity) },
  mp: { label: "Resolution", kinds: ["camera"], fn: (a, b) => (b.kind === "camera" ? b.megapixels : 0) - (a.kind === "camera" ? a.megapixels : 0) },
  aperture: { label: "Brightest aperture", kinds: ["lens"], fn: (a, b) => (a.kind === "lens" ? a.aperture : 99) - (b.kind === "lens" ? b.aperture : 99) },
  focal: { label: "Focal length", kinds: ["lens"], fn: (a, b) => (a.kind === "lens" ? a.eqMin : 0) - (b.kind === "lens" ? b.eqMin : 0) },
};

function Checks({ title, options, value, set }: { title: string; options: Opt[]; value: string[]; set: (v: string[]) => void }) {
  return (
    <fieldset>
      <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-subtle">{title}</legend>
      {options.map(([v, label]) => (
        <label key={v} className="flex cursor-pointer items-center gap-2 py-0.5 text-sm">
          <input type="checkbox" checked={value.includes(v)} onChange={() => set(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])} className="h-4 w-4" />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}

export default function Browser(props: Props) {
  const { kind, brands, mounts, market } = props;
  const items: ProductSummary[] = props.items;
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState<string[]>([]);
  const [mount, setMount] = useState<string[]>([]);
  const [sensor, setSensor] = useState<string[]>([]);
  const [type, setType] = useState<string[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [coverage, setCoverage] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [fromYear, setFromYear] = useState<number | null>(null);
  const [maxAperture, setMaxAperture] = useState<number | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState<SortKey>("newest");
  const [picked, setPicked] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const flag = (k: string) => Boolean(flags[k]);
  const setFlag = (k: string) => (v: boolean) => setFlags((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const list = (k: string) => sp.get(k)?.split(",").filter(Boolean) ?? [];
    if (sp.get("brand")) setBrand(list("brand"));
    if (sp.get("mount")) setMount(list("mount"));
    if (sp.get("type")) setType(list("type"));
    if (sp.get("sensor")) setSensor(list("sensor"));
    if (sp.get("category")) setCats(list("category"));
    if (sp.get("q")) setQ(sp.get("q")!);
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/α/g, "a");
    return items
      .filter((p) => !needle || `${p.brandName} ${p.name}`.toLowerCase().replace(/α/g, "a").includes(needle))
      .filter((p) => !brand.length || brand.includes(p.brand))
      .filter((p) => maxPrice === null || (priceOf(p) ?? Infinity) <= maxPrice)
      .filter((p) => fromYear === null || Number(p.announced.slice(0, 4)) >= fromYear)
      .filter((p) => !flag("sealed") || p.sealed)
      .filter((p) => !flag("current") || p.status === "current")
      .filter((p) => !flag("priced") || p.lowestNew !== null || p.lowestUsed !== null)
      .filter((p) => {
        if (p.kind === "camera") {
          return (
            (!type.length || type.includes(p.type)) &&
            (!sensor.length || sensor.includes(sensorGroup(p.sensor))) &&
            (!mount.length || (p.mount !== null && mount.includes(p.mount))) &&
            (!flag("ibis") || p.ibis) &&
            (!flag("4k60") || (p.video4kMaxFps ?? 0) >= 60) &&
            (!flag("flip") || p.articulating) &&
            (!flag("evf") || p.evf) &&
            (!flag("mic") || p.micJack)
          );
        }
        return (
          (!mount.length || p.mounts.some((m) => mount.includes(m))) &&
          (!coverage.length || coverage.includes(p.coverage)) &&
          (!cats.length || p.categories.some((c) => cats.includes(c))) &&
          (maxAperture === null || p.aperture <= maxAperture) &&
          (!flag("zoom") || p.focalMax > p.focalMin) &&
          (!flag("prime") || p.focalMax === p.focalMin) &&
          (!flag("af") || p.autofocus) &&
          (!flag("ois") || p.stabilized)
        );
      })
      .sort(SORTS[sort].fn);
  }, [items, q, brand, mount, sensor, type, cats, coverage, maxPrice, fromYear, maxAperture, flags, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (slug: string) => setPicked((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : p.length >= 4 ? p : [...p, slug]));
  const cur = items[0]?.currency ?? "USD";
  const sym = { USD: "$", GBP: "£", EUR: "€", AUD: "A$", SGD: "S$" }[cur];
  const budgets = kind === "camera" ? [500, 800, 1000, 1500, 2000, 3000, 5000] : [300, 500, 800, 1200, 2000, 3000];

  return (
    <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
      <aside className="flex flex-col gap-5">
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${kind === "camera" ? "cameras" : "lenses"}`} aria-label="Search" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
          <button type="button" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} className="btn-ghost lg:hidden">
            Filters
          </button>
        </div>
        <div className={`${filtersOpen ? "flex" : "hidden"} flex-col gap-5 lg:flex`}>
          {kind === "lens" && <Checks title="Mount" options={mounts} value={mount} set={setMount} />}
          {kind === "lens" && <Checks title="Type" options={LENS_CATS} value={cats} set={setCats} />}
          {kind === "camera" && <Checks title="Type" options={TYPES} value={type} set={setType} />}
          {kind === "camera" && <Checks title="Sensor" options={SENSORS} value={sensor} set={setSensor} />}
          <Checks title="Brand" options={brands} value={brand} set={setBrand} />
          {kind === "camera" && <Checks title="Mount" options={mounts} value={mount} set={setMount} />}
          {kind === "lens" && <Checks title="Made for" options={COVERAGE} value={coverage} set={setCoverage} />}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-subtle">Features</legend>
            {kind === "camera" ? (
              <>
                <Toggle label="In-body stabilisation" on={flag("ibis")} set={setFlag("ibis")} />
                <Toggle label="4K at 60p or more" on={flag("4k60")} set={setFlag("4k60")} />
                <Toggle label="Flip or articulating screen" on={flag("flip")} set={setFlag("flip")} />
                <Toggle label="Viewfinder" on={flag("evf")} set={setFlag("evf")} />
                <Toggle label="Mic input" on={flag("mic")} set={setFlag("mic")} />
              </>
            ) : (
              <>
                <Toggle label="Zoom" on={flag("zoom")} set={setFlag("zoom")} />
                <Toggle label="Prime" on={flag("prime")} set={setFlag("prime")} />
                <Toggle label="Autofocus" on={flag("af")} set={setFlag("af")} />
                <Toggle label="Optical stabilisation" on={flag("ois")} set={setFlag("ois")} />
              </>
            )}
            <Toggle label="Weather sealed" on={flag("sealed")} set={setFlag("sealed")} />
            <Toggle label="Still sold new" on={flag("current")} set={setFlag("current")} />
            <Toggle label="Has prices today" on={flag("priced")} set={setFlag("priced")} />
          </fieldset>
          {kind === "lens" && (
            <label className="text-sm">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-subtle">Aperture</span>
              <select value={maxAperture ?? ""} onChange={(e) => setMaxAperture(e.target.value ? Number(e.target.value) : null)} className="w-full rounded-lg border border-line bg-surface px-2 py-1.5">
                <option value="">Any</option>
                {[1.2, 1.4, 1.8, 2, 2.8, 4].map((a) => (
                  <option key={a} value={a}>f/{a} or brighter</option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-subtle">Budget</span>
            <select value={maxPrice ?? ""} onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : null)} className="w-full rounded-lg border border-line bg-surface px-2 py-1.5">
              <option value="">Any price</option>
              {budgets.map((p) => (
                <option key={p} value={p}>Under {sym}{p.toLocaleString("en-US")}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-subtle">Announced</span>
            <select value={fromYear ?? ""} onChange={(e) => setFromYear(e.target.value ? Number(e.target.value) : null)} className="w-full rounded-lg border border-line bg-surface px-2 py-1.5">
              <option value="">Any year</option>
              {[2025, 2024, 2023, 2022, 2020, 2018, 2016].map((y) => (
                <option key={y} value={y}>{y} or later</option>
              ))}
            </select>
          </label>
        </div>
      </aside>
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted" aria-live="polite">
            {shown.length} {kind === "camera" ? "camera" : "lens"}{shown.length === 1 ? "" : kind === "camera" ? "s" : "es"}
          </p>
          <label className="flex items-center gap-2">
            <span className="text-subtle">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-lg border border-line bg-surface px-2 py-1.5">
              {(Object.entries(SORTS) as [SortKey, (typeof SORTS)[SortKey]][]).filter(([, s]) => s.kinds.includes(kind)).map(([k, s]) => (
                <option key={k} value={k}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {shown.slice(0, 240).map((p) => (
            <div key={p.slug} className="relative">
              <ProductCard p={p} market={market} />
              <label className="absolute right-2 top-2 flex cursor-pointer items-center gap-1 rounded-md border border-line bg-surface/95 px-1.5 py-0.5 text-[11px] font-medium">
                <input type="checkbox" checked={picked.includes(p.slug)} onChange={() => pick(p.slug)} className="h-3.5 w-3.5" />
                Compare
              </label>
            </div>
          ))}
        </div>
        {shown.length > 240 && <p className="mt-4 text-sm text-muted">Showing the first 240. Narrow the filters to see the rest.</p>}
      </section>
      {picked.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 text-sm">
            <p className="truncate text-muted">
              {picked.map((s) => items.find((c) => c.slug === s)?.shortName).join(" · ")}
              <span className="ml-2 text-subtle">({picked.length}/4)</span>
            </p>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => setPicked([])} className="btn-ghost">Clear</button>
              {picked.length >= 2 ? (
                <Link href={marketPath(market, `/compare?c=${picked.join(",")}`)} className="btn-primary">Compare {picked.length}</Link>
              ) : (
                <span className="btn-ghost opacity-60">Pick one more</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
