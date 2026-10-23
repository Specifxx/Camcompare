"use client";
// One accessory category's listings with a small filter: accessory brand,
// camera brand (the "system" for flashes and triggers), camera model, and for
// cards and drives format, capacity and speed. Filters live in the query
// string (?brand=&cb=&camera=&format=&cap=&speed=&sort=) so a filtered view
// can be linked; the page itself is static and renders every row.
import { useEffect, useMemo, useState } from "react";
import { capacityText, perGbText } from "@/lib/accessory-format";
import type { AccessoryRow } from "@/lib/accessory-rows";
import { price } from "@/lib/format";
import AccessoryThumb from "./AccessoryThumb";
import OutboundLink from "./OutboundLink";
import EbayText from "./ebay/EbayText";
import { fillEbay, type EbayTemplate } from "@/lib/ebay-template";
import type { EbaySearchLink } from "@/lib/quickview";

type Filters = { brand: string; cb: string; camera: string; format: string; cap: string; speed: string; sort: string };
const EMPTY: Filters = { brand: "", cb: "", camera: "", format: "", cap: "", speed: "", sort: "" };
const KEYS = Object.keys(EMPTY) as (keyof Filters)[];
const PAGE = 120;

export default function AccessoryBrowser({
  rows,
  cams,
  cameraBrands,
  perGb,
  system,
  ebay = null,
}: {
  rows: AccessoryRow[];
  cams: Record<string, { name: string; brand: string }>;
  cameraBrands: Record<string, string>;
  /** Cards and drives: format, capacity, speed filters and price-per-GB sort. */
  perGb: boolean;
  /** Flashes and triggers: the camera-brand filter reads "System". */
  system: boolean;
  /**
   * eBay (none in Singapore): the category's tagged search, and a template
   * the filter's brand and camera fill ("SmallRig cage for Sony a7 IV").
   */
  ebay?: { all: EbaySearchLink; template: EbayTemplate; one: string; category: string } | null;
}) {
  const [f, setF] = useState<Filters>(EMPTY);
  const [shown, setShown] = useState(PAGE);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setF(Object.fromEntries(KEYS.map((k) => [k, q.get(k) ?? ""])) as Filters);
  }, []);
  const set = (k: keyof Filters, v: string) => {
    const next = { ...f, [k]: v, ...(k === "cb" ? { camera: "" } : {}) };
    setF(next);
    setShown(PAGE);
    const q = new URLSearchParams();
    for (const key of KEYS) if (next[key]) q.set(key, next[key]);
    const s = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${s ? `?${s}` : ""}`);
  };

  const brands = useMemo(() => [...new Map(rows.filter((r) => r.brand).map((r) => [r.brand!, r.brandName ?? r.brand!])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [rows]);
  const formats = useMemo(() => [...new Map(rows.filter((r) => r.format).map((r) => [r.format!, r.formatName ?? r.format!])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [rows]);
  const caps = useMemo(() => {
    const max = Math.max(0, ...rows.map((r) => r.specs.capacityGB ?? 0));
    return [32, 64, 128, 256, 512, 1000, 2000, 4000, 8000].filter((c) => c <= max);
  }, [rows]);
  const camOptions = Object.entries(cams)
    .filter(([, c]) => !f.cb || c.brand === f.cb)
    .sort((a, b) => a[1].name.localeCompare(b[1].name));

  const list = useMemo(() => {
    const out = rows.filter(
      (r) =>
        (!f.brand || r.brand === f.brand) &&
        (!f.cb || r.cameraBrands.includes(f.cb)) &&
        (!f.camera || r.cameras.includes(f.camera)) &&
        (!f.format || r.format === f.format) &&
        (!f.cap || (r.specs.capacityGB ?? 0) >= Number(f.cap)) &&
        (!f.speed || (r.specs.readMBs ?? 0) >= Number(f.speed)),
    );
    if (f.sort === "pergb") out.sort((a, b) => Number(b.inStock) - Number(a.inStock) || (a.perGB ?? Infinity) - (b.perGB ?? Infinity));
    else if (f.sort === "speed") out.sort((a, b) => (b.specs.readMBs ?? 0) - (a.specs.readMBs ?? 0) || a.price - b.price);
    return out;
  }, [rows, f]);

  // Compare brands: per accessory brand, cheapest and typical (median) in-stock price of what's filtered.
  const byBrand = useMemo(() => {
    const m = new Map<string, { name: string; prices: number[]; perGb: number[] }>();
    for (const r of list) {
      if (!r.inStock) continue;
      const k = r.brand ?? "";
      const e = m.get(k) ?? m.set(k, { name: r.brandName ?? "Other brands", prices: [], perGb: [] }).get(k)!;
      e.prices.push(r.price);
      if (r.perGB) e.perGb.push(r.perGB);
    }
    const mid = (xs: number[]) => {
      const s = [...xs].sort((a, b) => a - b);
      return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
    };
    return [...m.entries()]
      .map(([k, e]) => ({ k, name: e.name, n: e.prices.length, low: Math.min(...e.prices), mid: mid(e.prices), perGb: e.perGb.length ? Math.min(...e.perGb) : null }))
      .sort((a, b) => (a.k ? 0 : 1) - (b.k ? 0 : 1) || a.low - b.low);
  }, [list]);

  const cur = rows[0]?.currency ?? "USD";
  // One eBay search under the filter: the category, or what the filter has narrowed it to.
  const ebayNow = (() => {
    if (!ebay) return null;
    const brandName = f.brand ? brands.find(([k]) => k === f.brand)?.[1] ?? "" : "";
    const fits = f.camera && cams[f.camera] ? cams[f.camera].name : f.cb ? cameraBrands[f.cb] ?? "" : "";
    if (!brandName && !fits) return { link: ebay.all, label: ebay.all.label, placement: "acc-ebay" };
    const words = [brandName, ebay.one, fits ? `for ${fits}` : ""].filter(Boolean).join(" ");
    return { link: { ...ebay.template, href: fillEbay(ebay.template.href, words) }, label: `${words.charAt(0).toUpperCase()}${words.slice(1)} on eBay`, placement: "acc-ebay-camera" };
  })();
  const sel = "rounded-md border border-line bg-surface px-2 py-1.5 text-sm";
  return (
    <div className="flex flex-col gap-6">
      <div className="card flex flex-wrap items-end gap-3 p-3" role="search" aria-label="Filter listings">
        {brands.length > 1 && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Accessory brand
            <select className={sel} value={f.brand} onChange={(e) => set("brand", e.target.value)}>
              <option value="">All brands</option>
              {brands.map(([k, n]) => (
                <option key={k} value={k}>{n}</option>
              ))}
            </select>
          </label>
        )}
        {Object.keys(cameraBrands).length > 0 && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            {system ? "System" : "Camera brand"}
            <select className={sel} value={f.cb} onChange={(e) => set("cb", e.target.value)}>
              <option value="">Any</option>
              {Object.entries(cameraBrands)
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([k, n]) => (
                  <option key={k} value={k}>{n}</option>
                ))}
            </select>
          </label>
        )}
        {camOptions.length > 0 && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Camera
            <select className={sel} value={f.camera} onChange={(e) => set("camera", e.target.value)}>
              <option value="">Any camera</option>
              {camOptions.map(([k, c]) => (
                <option key={k} value={k}>{c.name}</option>
              ))}
            </select>
          </label>
        )}
        {formats.length > 1 && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Format
            <select className={sel} value={f.format} onChange={(e) => set("format", e.target.value)}>
              <option value="">All formats</option>
              {formats.map(([k, n]) => (
                <option key={k} value={k}>{n}</option>
              ))}
            </select>
          </label>
        )}
        {perGb && caps.length > 1 && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Capacity
            <select className={sel} value={f.cap} onChange={(e) => set("cap", e.target.value)}>
              <option value="">Any</option>
              {caps.map((c) => (
                <option key={c} value={c}>{capacityText(c)} or more</option>
              ))}
            </select>
          </label>
        )}
        {perGb && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Min read speed
            <select className={sel} value={f.speed} onChange={(e) => set("speed", e.target.value)}>
              <option value="">Any</option>
              {[90, 150, 250, 500, 1000, 1500, 2000, 3000].map((s) => (
                <option key={s} value={s}>{s} MB/s</option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted">
          Sort
          <select className={sel} value={f.sort} onChange={(e) => set("sort", e.target.value)}>
            <option value="">Price</option>
            {perGb && <option value="pergb">Price per GB</option>}
            {perGb && <option value="speed">Fastest</option>}
          </select>
        </label>
        <p className="ml-auto text-xs text-subtle">{list.length} of {rows.length} listings</p>
      </div>
      {ebayNow && (
        <p className="-mt-3 text-sm">
          <EbayText link={ebayNow.link} product={`acc-${ebay!.category}`} placement={ebayNow.placement}>{ebayNow.label}</EbayText>
        </p>
      )}

      {byBrand.length > 1 && (
        <section>
          <h2 className="h-section mb-3">Compare brands</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Brand</th>
                  <th className="px-3 py-2 font-medium">In stock</th>
                  <th className="px-3 py-2 text-right font-medium">Cheapest</th>
                  <th className="px-3 py-2 text-right font-medium">Typical</th>
                  {perGb && <th className="px-3 py-2 text-right font-medium">Best per GB</th>}
                </tr>
              </thead>
              <tbody>
                {byBrand.map((b) => (
                  <tr key={b.k || "other"} className="border-t border-line">
                    <td className="px-3 py-2">
                      {b.k ? (
                        <button type="button" className="font-semibold text-fg underline-offset-2 hover:underline" onClick={() => set("brand", f.brand === b.k ? "" : b.k)}>
                          {b.name}
                        </button>
                      ) : (
                        <span className="text-muted">{b.name}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted">{b.n}</td>
                    <td className="price px-3 py-2 text-right font-semibold">{price(b.low, cur)}</td>
                    <td className="price px-3 py-2 text-right">{price(b.mid, cur)}</td>
                    {perGb && <td className="price px-3 py-2 text-right">{b.perGb ? perGbText(b.perGb, cur) : "–"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-xs text-subtle">Typical is the median in-stock price of each brand&apos;s listings above. Click a brand to filter.</p>
        </section>
      )}

      <section>
        <h2 className="h-section mb-3">Listings</h2>
        {list.length === 0 ? (
          <p className="card p-4 text-sm text-muted">Nothing matches these filters.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {list.slice(0, shown).map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                <AccessoryThumb src={r.image} alt={r.title} group={r.group} store={r.retailerName} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">{r.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {r.retailerName} · {r.condition} · <span className={r.inStock ? "text-win" : "font-medium text-warn"}>{r.inStock ? "In stock" : "Out of stock"}</span>
                    {r.brandName ? ` · ${r.brandName}` : ""}
                  </p>
                  {(r.spec || r.cameras.length > 0) && (
                    <p className="mt-0.5 text-xs text-subtle">
                      {r.spec}
                      {r.spec && r.cameras.length > 0 ? " · " : ""}
                      {r.cameras.length > 0 ? `For ${r.cameras.map((s) => cams[s]?.name ?? s).join(", ")}` : ""}
                    </p>
                  )}
                </div>
                {/* Phones: price above the button, so the title keeps its width. */}
                <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                  <div className="text-right">
                    <p className={`price font-bold ${r.inStock ? "" : "text-muted"}`}>{price(r.price, r.currency)}</p>
                    {r.perGB !== null && <p className="text-[11px] text-subtle">{perGbText(r.perGB, r.currency)}</p>}
                  </div>
                  <div className="w-20 text-right">
                    <OutboundLink href={r.href} retailer={r.retailer} product={`acc-${r.category}`} placement="accessory-list" className={`${r.paid ? "btn-buy" : "btn-ghost"} w-full px-2`}>
                      View<span className="sr-only"> at {r.retailerName}</span>
                    </OutboundLink>
                    {r.paid && <p className="mt-0.5 text-[10px] leading-none text-subtle">Paid link</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {list.length > shown && (
          <button type="button" className="btn-ghost mt-3" onClick={() => setShown((s) => s + PAGE)}>
            Show more ({list.length - shown} left)
          </button>
        )}
      </section>
    </div>
  );
}
