import { price } from "@/lib/format";
import type { Currency } from "@/lib/markets";
import type { HistoryPoint } from "@/lib/offers";

/** A server-rendered SVG: no chart library, nothing to hydrate. */
export default function PriceHistory({ points, currency }: { points: HistoryPoint[]; currency: Currency }) {
  const series = (["new", "used"] as const).map((k) => ({ k, pts: points.filter((p) => p[k] !== undefined).map((p) => ({ day: p.day, v: p[k]! })) }));
  const all = series.flatMap((s) => s.pts);
  if (all.length < 2) {
    return <p className="text-sm text-muted">Price history starts the day we first price this product here; a chart appears after the second day.</p>;
  }
  const days = [...new Set(points.map((p) => p.day))].sort();
  const W = 480;
  const H = 200;
  const pad = { l: 64, r: 12, t: 12, b: 24 };
  const min = Math.min(...all.map((p) => p.v));
  const max = Math.max(...all.map((p) => p.v));
  const span = max - min || max * 0.1 || 1;
  const x = (d: string) => pad.l + (days.indexOf(d) / Math.max(1, days.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (H - pad.t - pad.b);
  const colors = { new: "rgb(var(--c-accent))", used: "rgb(var(--c-warn))" };
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-xl" role="img" aria-label="Lowest price per day, new and used">
        {[min, min + span / 2, max].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="rgb(var(--c-line))" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="12" fill="rgb(var(--c-subtle))">
              {price(v, currency)}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 6} fontSize="12" fill="rgb(var(--c-subtle))">{days[0]}</text>
        <text x={W - pad.r} y={H - 6} fontSize="12" textAnchor="end" fill="rgb(var(--c-subtle))">{days[days.length - 1]}</text>
        {series.map(({ k, pts }) =>
          pts.length > 1 ? <polyline key={k} fill="none" stroke={colors[k]} strokeWidth="2" points={pts.map((p) => `${x(p.day)},${y(p.v)}`).join(" ")} /> : null,
        )}
      </svg>
      <figcaption className="mt-1 flex gap-4 text-xs text-muted">
        <span><span className="mr-1 inline-block h-2 w-3 rounded-sm bg-accent align-middle" />Lowest new</span>
        <span><span className="mr-1 inline-block h-2 w-3 rounded-sm bg-warn align-middle" />Lowest used</span>
      </figcaption>
    </figure>
  );
}
