// Price per GB over time for memory cards and drives: one small line per
// format and capacity, from data/accessory-history (the lowest in-stock new
// price each day). Server-rendered SVG, nothing to hydrate. Hidden until a
// series has two days.
import { capacityText, perGbText } from "@/lib/accessory-format";
import type { AccessoryHistoryDay } from "@/lib/accessory-data";
import type { Currency } from "@/lib/markets";

type Series = { key: string; label: string; pts: { day: string; v: number }[] };

export default function PerGbTrend({ history, category, currency, formatName }: { history: AccessoryHistoryDay[]; category: string; currency: Currency; formatName: (f: string) => string }) {
  const map = new Map<string, Series>();
  for (const d of history)
    for (const r of d.rows) {
      if (r.category !== category) continue;
      const key = `${r.format}|${r.capacityGB}`;
      const s = map.get(key) ?? map.set(key, { key, label: `${formatName(r.format)} ${capacityText(r.capacityGB)}`, pts: [] }).get(key)!;
      s.pts.push({ day: d.day, v: r.lowestPerGB });
    }
  // The series with the longest record, up to eight.
  const series = [...map.values()].filter((s) => s.pts.length >= 2).sort((a, b) => b.pts.length - a.pts.length || a.label.localeCompare(b.label)).slice(0, 8);
  if (!series.length) return null;
  const W = 220;
  const H = 56;
  return (
    <section>
      <h2 className="h-section mb-1">Price per GB over time</h2>
      <p className="mb-3 text-sm text-muted">The lowest in-stock new price per GB each day, by format and capacity, from our own record of every price check.</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {series.map((s) => {
          const vs = s.pts.map((p) => p.v);
          const min = Math.min(...vs);
          const max = Math.max(...vs);
          const span = max - min || max * 0.1 || 1;
          const x = (i: number) => 4 + (i / Math.max(1, s.pts.length - 1)) * (W - 8);
          const y = (v: number) => 4 + (1 - (v - min) / span) * (H - 8);
          const first = vs[0];
          const last = vs[vs.length - 1];
          const pct = first ? Math.round(((last - first) / first) * 100) : 0;
          return (
            <li key={s.key} className="card p-3">
              <p className="text-sm font-semibold">{s.label}</p>
              <p className="text-xs text-muted">
                <span className="price font-bold text-fg">{perGbText(last, currency)}</span>
                {pct !== 0 && <span className={pct < 0 ? "text-win" : "text-warn"}> {pct > 0 ? "+" : "−"}{Math.abs(pct)}% since {s.pts[0].day}</span>}
              </p>
              <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-14 w-full" role="img" aria-label={`${s.label}: lowest price per GB, ${s.pts[0].day} to ${s.pts[s.pts.length - 1].day}`}>
                <polyline fill="none" stroke="rgb(var(--c-accent))" strokeWidth="2" points={s.pts.map((p, i) => `${x(i)},${y(p.v)}`).join(" ")} />
                <circle cx={x(s.pts.length - 1)} cy={y(last)} r="3" fill="rgb(var(--c-accent))" />
              </svg>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
