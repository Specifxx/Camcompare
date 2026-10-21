"use client";
// The drawing under PriceHistory and PairPriceHistory: a time-scaled SVG line
// chart with a crosshair tooltip, sized to its container. A series' recorded
// days are a solid line; its archived days (from archived store pages,
// lib/price-history-archive.ts) a dashed line with hollow dots, so the two
// are never mistaken for each other. No chart library.
import { useEffect, useMemo, useRef, useState } from "react";
import { price } from "@/lib/format";
import type { Currency } from "@/lib/markets";

export type ChartPt = { day: string; v: number; at?: string; archived: boolean };
export type ChartSeries = { key: string; label: string; color: string; points: ChartPt[] };

const DAY = 86400_000;
const t = (d: string) => Date.parse(d);
const fmtDay = (d: string) => new Date(t(d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtMonth = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });

/** 3–5 round price steps (minor units) covering [lo, hi]. */
function ticks(lo: number, hi: number): number[] {
  const span = Math.max(hi - lo, hi * 0.02, 100);
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out.length ? out : [lo];
}

/** Splits a series where it changes between recorded and archived, so each run gets its own stroke. */
function runs(points: ChartPt[]): ChartPt[][] {
  const out: ChartPt[][] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && last[0].archived === p.archived) last.push(p);
    else out.push([p]);
  }
  return out;
}

export default function HistoryChart({ series, currency, from, to, height = 220, label }: { series: ChartSeries[]; currency: Currency; from: string; to: string; height?: number; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const all = series.flatMap((s) => s.points);
  const days = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.day)))].sort(), [series]);
  const H = height;
  const pad = { l: 8, r: 8, t: 10, b: 24 };
  const x0 = t(from);
  const x1 = Math.max(t(to), x0 + DAY);
  const lo = Math.min(...all.map((p) => p.v));
  const hi = Math.max(...all.map((p) => p.v));
  const margin = Math.max((hi - lo) * 0.08, hi * 0.01, 100);
  const yTicks = all.length ? ticks(lo - margin, hi + margin) : [];
  const yMin = Math.min(lo - margin, yTicks[0] ?? lo);
  const yMax = Math.max(hi + margin, yTicks[yTicks.length - 1] ?? hi);
  const labelW = Math.max(...yTicks.map((v) => price(v, currency).length)) * 7 + 8;
  const left = pad.l + labelW;
  const x = (d: string) => left + ((t(d) - x0) / (x1 - x0)) * (w - left - pad.r);
  const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - pad.t - pad.b);

  // Month ticks, at most ~one per 80px.
  const xTicks: number[] = [];
  if (w) {
    const months: number[] = [];
    const d = new Date(x0);
    for (let m = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); m <= x1; m = Date.UTC(new Date(m).getUTCFullYear(), new Date(m).getUTCMonth() + 1, 1)) months.push(m);
    const every = Math.max(1, Math.ceil(months.length / Math.max(1, Math.floor((w - left) / 80))));
    months.forEach((m, i) => i % every === 0 && xTicks.push(m));
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!days.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = days[0];
    for (const d of days) if (Math.abs(x(d) - px) < Math.abs(x(best) - px)) best = d;
    setHover(best);
  };
  const at = hover ? series.map((s) => ({ s, p: s.points.find((p) => p.day === hover) })).filter((r) => r.p) : [];
  const hx = hover ? x(hover) : 0;

  return (
    <div ref={box} className="relative w-full" style={{ height: H }}>
      {w > 0 && (
        <svg width={w} height={H} role="img" aria-label={label} onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="touch-pan-y select-none">
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={left} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="rgb(var(--c-line))" />
              <text x={left - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="rgb(var(--c-subtle))">
                {price(v, currency)}
              </text>
            </g>
          ))}
          {xTicks.map((m) => {
            const xx = left + ((m - x0) / (x1 - x0)) * (w - left - pad.r);
            return (
              <text key={m} x={xx} y={H - 6} fontSize="11" textAnchor="middle" fill="rgb(var(--c-subtle))">
                {fmtMonth(m)}
              </text>
            );
          })}
          {series.map((s) =>
            runs(s.points).map((run, i) => (
              <g key={`${s.key}-${i}`}>
                {run.length > 1 && (
                  <polyline
                    fill="none"
                    stroke={s.color}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeDasharray={run[0].archived ? "5 4" : undefined}
                    points={run.map((p) => `${x(p.day).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")}
                  />
                )}
                {run[0].archived
                  ? run.map((p) => <circle key={p.day} cx={x(p.day)} cy={y(p.v)} r="3.5" fill="rgb(var(--c-surface))" stroke={s.color} strokeWidth="1.75" />)
                  : (run.length === 1 || run.length <= 12) && run.map((p) => <circle key={p.day} cx={x(p.day)} cy={y(p.v)} r="3" fill={s.color} stroke="rgb(var(--c-surface))" strokeWidth="1.5" />)}
              </g>
            )),
          )}
          {hover && (
            <g pointerEvents="none">
              <line x1={hx} x2={hx} y1={pad.t} y2={H - pad.b} stroke="rgb(var(--c-subtle))" strokeWidth="1" />
              {at.map(({ s, p }) => (
                <circle key={s.key} cx={hx} cy={y(p!.v)} r="4.5" fill={p!.archived ? "rgb(var(--c-surface))" : s.color} stroke={p!.archived ? s.color : "rgb(var(--c-surface))"} strokeWidth="2" />
              ))}
            </g>
          )}
        </svg>
      )}
      {hover && at.length > 0 && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-[10rem] max-w-[16rem] rounded-lg border border-line bg-surface p-2 text-xs shadow-lift"
          style={hx > w / 2 ? { right: w - hx + 10 } : { left: hx + 10 }}
        >
          <p className="mb-1 font-semibold text-fg">{fmtDay(hover)}</p>
          {at.map(({ s, p }) => (
            <p key={s.key} className="flex items-baseline gap-1.5">
              <span aria-hidden className="inline-block w-3 border-t-2" style={{ borderColor: s.color, borderStyle: p!.archived ? "dashed" : "solid" }} />
              <span className="price font-bold text-fg">{price(p!.v, currency)}</span>
              <span className="text-muted">
                {s.label}
                {p!.at ? ` · ${p!.at}` : ""}
              </span>
            </p>
          ))}
          {at.some(({ p }) => p!.archived) && <p className="mt-1 text-[11px] text-subtle">From an archived copy of the store&apos;s page</p>}
        </div>
      )}
    </div>
  );
}
