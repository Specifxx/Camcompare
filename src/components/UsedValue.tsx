import { price } from "@/lib/format";
import type { Currency } from "@/lib/markets";
import type { HistoryPoint } from "@/lib/offers";
import { usedByMonth, usedValue } from "@/lib/value";

const MONTH = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

const W = 600;
const H = 170;
const PAD = { l: 8, r: 8, t: 12, b: 22 };

/**
 * Daily typical used price (median asking price, else the cheapest) and
 * lowest new price as two lines. Plain SVG, colours from the theme's CSS
 * variables, with a title and description for screen readers.
 */
function UsedChart({ history, currency, name }: { history: HistoryPoint[]; currency: Currency; name: string }) {
  const pts = history.filter((p) => (p.usedMid ?? p.used) !== undefined || p.new !== undefined);
  if (pts.length < 2) return null;
  const t0 = Date.parse(pts[0].day);
  const t1 = Date.parse(pts[pts.length - 1].day);
  const vals = pts.flatMap((p) => [p.usedMid ?? p.used, p.new]).filter((v): v is number => v !== undefined);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || hi * 0.1 || 1;
  const [y0, y1] = [lo - span * 0.08, hi + span * 0.08];
  const x = (day: string) => PAD.l + ((Date.parse(day) - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);
  const line = (get: (p: HistoryPoint) => number | undefined) => {
    let d = "";
    let pen = false;
    for (const p of pts) {
      const v = get(p);
      if (v === undefined) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${x(p.day).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const used = line((p) => p.usedMid ?? p.used);
  const fresh = line((p) => p.new);
  const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const lastUsed = [...pts].reverse().find((p) => (p.usedMid ?? p.used) !== undefined);
  const lastNew = [...pts].reverse().find((p) => p.new !== undefined);
  const desc = `From ${fmt(pts[0].day)} to ${fmt(pts[pts.length - 1].day)}, prices between ${price(lo, currency)} and ${price(hi, currency)}.${lastUsed ? ` Latest typical used ${price((lastUsed.usedMid ?? lastUsed.used)!, currency)}.` : ""}${lastNew ? ` Latest lowest new ${price(lastNew.new!, currency)}.` : ""}`;
  return (
    <figure className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby="uv-title uv-desc">
        <title id="uv-title">{`${name}: typical used and lowest new price by day`}</title>
        <desc id="uv-desc">{desc}</desc>
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + f * (H - PAD.t - PAD.b)} y2={PAD.t + f * (H - PAD.t - PAD.b)} stroke="rgb(var(--c-line))" strokeDasharray={f === 1 ? undefined : "3 4"} />
        ))}
        {fresh && <path d={fresh} fill="none" stroke="rgb(var(--c-buy))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        {used && <path d={used} fill="none" stroke="rgb(var(--c-accent))" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        <text x={PAD.l} y={H - 6} fontSize="11" fill="rgb(var(--c-subtle))">{fmt(pts[0].day)}</text>
        <text x={W - PAD.r} y={H - 6} fontSize="11" textAnchor="end" fill="rgb(var(--c-subtle))">{fmt(pts[pts.length - 1].day)}</text>
        <text x={W - PAD.r} y={PAD.t - 2} fontSize="11" textAnchor="end" fill="rgb(var(--c-subtle))">{price(hi, currency)}</text>
        <text x={W - PAD.r} y={H - PAD.b - 4} fontSize="11" textAnchor="end" fill="rgb(var(--c-subtle))">{price(lo, currency)}</text>
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 text-xs text-muted">
        {used && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-0.5 w-4 bg-accent" /> Typical used
          </span>
        )}
        {fresh && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-0.5 w-4 bg-buy" /> Lowest new
          </span>
        )}
      </figcaption>
    </figure>
  );
}

/** "Should be worth" used, how today's cheapest used compares, and used prices month by month. */
export default function UsedValue({ history, currency, todayUsed, name }: { history: HistoryPoint[]; currency: Currency; todayUsed: number | null; name: string }) {
  const v = usedValue(history);
  const months = usedByMonth(history);
  const usedDays = history.filter((p) => p.used !== undefined).length;
  const delta = v && todayUsed !== null ? Math.round(((todayUsed - v.value) / v.value) * 100) : null;
  return (
    <div className="card flex flex-col gap-4 p-4">
      {v ? (
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Should be worth, used</p>
            <p className="price text-3xl font-bold">{price(v.value, currency)}</p>
            <p className="text-xs text-muted">
              Usually {price(v.low, currency)} to {price(v.high, currency)} · {v.days} days, {v.listings} listings
            </p>
          </div>
          {todayUsed !== null && delta !== null && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Cheapest used today</p>
              <p className="price text-xl font-bold">{price(todayUsed, currency)}</p>
              <p className={`text-xs font-semibold ${delta <= -5 ? "text-win" : delta >= 5 ? "text-warn" : "text-muted"}`}>
                {delta <= -5 ? `${-delta}% under what it usually goes for` : delta >= 5 ? `${delta}% over what it usually goes for` : "About what it usually goes for"}
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">
          {usedDays ? `We've seen used ${name} prices on ${usedDays} day${usedDays === 1 ? "" : "s"} so far.` : `No used ${name} listings at the stores we track yet.`} A &quot;should be worth&quot; value appears after a week of used prices.
        </p>
      )}
      <UsedChart history={history} currency={currency} name={name} />
      {months.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-subtle">
                <th className="py-1.5 pr-3 font-semibold">Month</th>
                <th className="py-1.5 pr-3 font-semibold">Cheapest</th>
                <th className="py-1.5 pr-3 font-semibold">Typical</th>
                <th className="py-1.5 pr-3 font-semibold">Highest</th>
                <th className="py-1.5 font-semibold">Days seen</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month} className="border-b border-line/60 last:border-0">
                  <td className="py-1.5 pr-3">{MONTH(m.month)}</td>
                  <td className="price py-1.5 pr-3 font-semibold">{price(m.low, currency)}</td>
                  <td className="price py-1.5 pr-3">{price(m.typical, currency)}</td>
                  <td className="price py-1.5 pr-3">{price(m.high, currency)}</td>
                  <td className="py-1.5 text-muted">{m.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-subtle">
        From used and refurbished asking prices at the stores we track, checked every few hours. Confirmed eBay sale prices will be added once eBay grants us access to its sold-listings data.
      </p>
    </div>
  );
}
