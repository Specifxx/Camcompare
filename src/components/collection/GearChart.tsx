"use client";
// My gear's value over time: one line for what the collection is worth
// (blue), one dashed grey line for what those items cost, on one axis in
// one currency. Hover or tap for the day's numbers; a table view follows.
import { useEffect, useMemo, useRef, useState } from "react";
import type { SeriesPoint } from "@/lib/collection";
import { money, type Currency } from "@/lib/markets";

// Drawn at the width it is shown (measured), so text stays 11px on a phone.
const H = 200;
const PAD = { l: 8, r: 8, t: 12, b: 22 };

const short = (minor: number, cur: Currency) => {
  const v = minor / 100;
  const sym = { USD: "$", GBP: "£", EUR: "€", AUD: "A$", SGD: "S$" }[cur];
  return v >= 10_000 ? `${sym}${Math.round(v / 1000)}k` : v >= 1000 ? `${sym}${(v / 1000).toFixed(1)}k` : `${sym}${Math.round(v)}`;
};
const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default function GearChart({ points, currency }: { points: SeriesPoint[]; currency: Currency }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => e.contentRect.width > 0 && setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const geo = useMemo(() => {
    const vals = points.flatMap((p) => [p.value, p.paid]).filter((v) => v > 0);
    const max = Math.max(...vals, 1);
    const min = Math.min(...vals, max);
    const lo = Math.max(0, min - (max - min) * 0.15 - max * 0.02);
    const hi = max + (max - lo) * 0.08;
    const x = (i: number) => PAD.l + (points.length < 2 ? (W - PAD.l - PAD.r) / 2 : (i / (points.length - 1)) * (W - PAD.l - PAD.r));
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
    const line = (k: "value" | "paid") => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
    return { x, y, lo, hi, value: line("value"), paid: line("paid"), anyPaid: points.some((p) => p.paid > 0) };
  }, [points, W]);

  if (!points.length) return null;
  const last = points[points.length - 1];
  const h = hover !== null ? points[hover] : null;
  const pick = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const rel = ((clientX - r.left) / r.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(geo.x(i) - rel) < Math.abs(geo.x(best) - rel)) best = i;
    setHover(best);
  };

  return (
    <figure className="mt-2">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4 rounded bg-accent" /> Estimated value
        </span>
        {geo.anyPaid && (
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block w-4 border-t-2 border-dashed border-subtle" /> What you paid
          </span>
        )}
        <span className="ml-auto text-subtle" aria-live="polite">
          {h ? `${dayLabel(h.day)}: ${money(h.value, currency, true)}${geo.anyPaid ? ` · paid ${money(h.paid, currency, true)}` : ""}` : `${points.length} day${points.length === 1 ? "" : "s"} of prices`}
        </span>
      </figcaption>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 block w-full touch-pan-y select-none"
        height={H}
        role="img"
        aria-label={`Estimated value from ${money(points[0].value, currency, true)} on ${dayLabel(points[0].day)} to ${money(last.value, currency, true)} on ${dayLabel(last.day)}`}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        {[geo.lo, (geo.lo + geo.hi) / 2, geo.hi].map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={geo.y(v)} y2={geo.y(v)} className="stroke-line" strokeWidth={1} />
            <text x={PAD.l + 2} y={geo.y(v) - 3} className="fill-subtle text-[11px]">
              {short(v, currency)}
            </text>
          </g>
        ))}
        <text x={PAD.l} y={H - 6} className="fill-subtle text-[11px]">
          {dayLabel(points[0].day)}
        </text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end" className="fill-subtle text-[11px]">
          {dayLabel(last.day)}
        </text>
        {geo.anyPaid && <path d={geo.paid} fill="none" className="stroke-subtle" strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" />}
        <path d={geo.value} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.length === 1 && <circle cx={geo.x(0)} cy={geo.y(last.value)} r={4} className="fill-accent" />}
        {h && hover !== null && (
          <g>
            <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.t} y2={H - PAD.b} className="stroke-muted" strokeWidth={1} />
            <circle cx={geo.x(hover)} cy={geo.y(h.value)} r={4.5} className="fill-accent stroke-surface" strokeWidth={2} />
          </g>
        )}
      </svg>
      <details className="mt-1 text-xs">
        <summary className="cursor-pointer text-muted">Show as a table</summary>
        <table className="mt-1 w-full text-left">
          <thead className="text-subtle">
            <tr>
              <th className="py-0.5 font-normal">Day</th>
              <th className="py-0.5 text-right font-normal">Estimated value</th>
              <th className="py-0.5 text-right font-normal">Paid</th>
            </tr>
          </thead>
          <tbody className="price">
            {[...points].reverse().map((p) => (
              <tr key={p.day} className="border-t border-line">
                <td className="py-0.5">{p.day}</td>
                <td className="py-0.5 text-right">{money(p.value, currency, true)}</td>
                <td className="py-0.5 text-right">{p.paid ? money(p.paid, currency, true) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
