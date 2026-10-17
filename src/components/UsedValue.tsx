import { price } from "@/lib/format";
import type { Currency } from "@/lib/markets";
import type { HistoryPoint } from "@/lib/offers";
import { usedByMonth, usedValue } from "@/lib/value";

const MONTH = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

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
