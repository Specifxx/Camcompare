"use client";
// A product's price history, like camelcamelcamel: lowest new and used per
// day, recorded (solid) and from archived store pages (dashed, hollow dots),
// ranges 1M–All, a crosshair tooltip with the store and the day, the range's
// lowest / typical / highest, and "Is this a good price?".
// The data is a static file per product and market (public/history/…,
// scripts/build-history-data.ts, lib/history-chart.ts) fetched after the page
// renders, so the product page's HTML carries none of it.
import { useEffect, useMemo, useState } from "react";
import HistoryChart, { type ChartSeries } from "@/components/HistoryChart";
import { price } from "@/lib/format";
import { decodeHistory, historyJsonPath, type ChartToday, type HistoryJson } from "@/lib/history-chart";
import type { Currency, MarketCode } from "@/lib/markets";
import type { ChartDay } from "@/lib/offers";
import { inRange, priceVerdict, RANGES, RANGE_DAYS, seriesStats, type RangeKey } from "@/lib/value";

const COLORS = { new: "rgb(var(--c-accent))", used: "rgb(var(--c-win))" } as const;
const fmtDay = (d: string) => new Date(Date.parse(d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

type Data = { currency: Currency; days: ChartDay[]; today: ChartToday };

/**
 * Opens the page's "Track this price" form (components/PriceAlert.tsx) and
 * scrolls to it: by its id when it has one, else by the button's label.
 */
function openTracker(e: React.MouseEvent) {
  const btn =
    (document.getElementById("track-price") as HTMLButtonElement | null) ??
    [...document.querySelectorAll<HTMLButtonElement>("button[aria-controls]")].find((b) => b.textContent?.trim() === "Track this price") ??
    null;
  if (!btn) return;
  e.preventDefault();
  btn.scrollIntoView({ behavior: "smooth", block: "center" });
  if (btn.getAttribute("aria-expanded") !== "true") btn.click();
}

export default function PriceHistory({ slug, market, currency }: { slug: string; market: MarketCode; currency: Currency }) {
  const [data, setData] = useState<Data | null | "none">(null);
  const [range, setRange] = useState<RangeKey | null>(null);
  useEffect(() => {
    let live = true;
    fetch(historyJsonPath(market, slug))
      .then((r) => (r.ok ? (r.json() as Promise<HistoryJson>) : null))
      .then((j) => live && setData(j ? decodeHistory(j) : "none"))
      .catch(() => live && setData("none"));
    return () => {
      live = false;
    };
  }, [slug, market]);

  const last = data && data !== "none" ? (data.days[data.days.length - 1]?.day ?? data.today.day) : "";
  const first = data && data !== "none" ? (data.days[0]?.day ?? last) : "";
  const spanDays = last ? (Date.parse(last) - Date.parse(first)) / 86400_000 : 0;
  // Ranges the data reaches into; the default is the shortest that shows it all, up to a year.
  const offered = RANGES.filter((r, i) => r === "All" || i === 0 || RANGE_DAYS[RANGES[i - 1]] < spanDays);
  const r: RangeKey = range ?? (RANGES.find((k) => k !== "All" && RANGE_DAYS[k] >= spanDays) ?? "1Y");
  const shown = useMemo(() => (data && data !== "none" ? inRange(data.days, r, last) : []), [data, r, last]);

  if (data === null) return <div className="h-[340px] animate-pulse rounded-lg bg-raised/60" aria-busy="true" aria-label="Loading price history" />;
  if (data === "none" || data.days.filter((d) => d.new !== undefined || d.used !== undefined).length < 2)
    return <p className="text-sm text-muted">Price history starts the day we first price this product here; a chart appears after the second day.</p>;

  const cur = data.currency ?? currency;
  const series: ChartSeries[] = (["new", "used"] as const)
    .map((k) => ({
      key: k,
      label: k === "new" ? "Lowest new" : "Lowest used",
      color: COLORS[k],
      points: shown.filter((d) => d[k] !== undefined).map((d) => ({ day: d.day, v: d[k]!, at: k === "new" ? d.newAt : d.usedAt, archived: d.archived })),
    }))
    .filter((s) => s.points.length);
  const hasArchived = shown.some((d) => d.archived);
  const field: "new" | "used" = data.today.new !== null ? "new" : "used";
  const today = field === "new" ? data.today.new : data.today.used;
  const todayAt = field === "new" ? data.today.newAt : data.today.usedAt;
  const verdict = priceVerdict(data.days, today, field, last);
  const from = r === "All" ? first : (() => {
    const f = new Date(Date.parse(last) - RANGE_DAYS[r] * 86400_000).toISOString().slice(0, 10);
    return f < first ? first : f;
  })();
  const tone = {
    good: "border-buy/40 bg-buy-soft",
    fair: "border-line bg-raised/50",
    high: "border-warn/40 bg-raised/50",
    unknown: "border-line bg-raised/50",
  }[verdict.tone];

  return (
    <div className="flex flex-col gap-3">
      <div className={`rounded-lg border p-3 ${tone}`}>
        <p className="text-xs font-bold uppercase tracking-wide text-subtle">Is this a good price?</p>
        <p className={`mt-0.5 font-bold ${verdict.tone === "good" ? "text-win" : verdict.tone === "high" ? "text-warn" : "text-fg"}`}>{verdict.headline}</p>
        {today !== null && verdict.typical !== null && (
          <p className="mt-0.5 text-sm text-muted">
            Today <span className="price font-semibold text-fg">{price(today, cur)}</span> {field === "used" ? "used" : "new"}
            {todayAt ? ` at ${todayAt}` : ""}
            {verdict.vsTypical !== null && verdict.vsTypical !== 0 ? ` · ${Math.abs(verdict.vsTypical)}% ${verdict.vsTypical < 0 ? "under" : "over"} the typical ${price(verdict.typical, cur)}` : ` · typical ${price(verdict.typical, cur)}`}
            {verdict.low ? ` · lowest ${price(verdict.low.value, cur)} (${fmtDay(verdict.low.day)})` : ""}
          </p>
        )}
        <p className="mt-1 text-sm">
          <a href="#track-price" onClick={openTracker}>
            {verdict.tone === "good" ? "Want it lower still? Track this price →" : "Wait for a better price: track this price →"}
          </a>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Range">
        {offered.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setRange(k)}
            aria-pressed={k === r}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${k === r ? "bg-accent text-accent-fg" : "bg-raised text-muted hover:text-fg"}`}
          >
            {k}
          </button>
        ))}
      </div>

      <HistoryChart series={series} currency={cur} from={from} to={last} label={`Lowest new and used price per day, ${r === "All" ? "all history" : `last ${r}`}`} />

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block w-4 border-t-2" style={{ borderColor: s.color }} />
            {s.label}
          </span>
        ))}
        {hasArchived && (
          <span className="inline-flex items-center gap-1.5">
            <svg aria-hidden width="22" height="8">
              <line x1="0" x2="22" y1="4" y2="4" stroke="rgb(var(--c-subtle))" strokeWidth="2" strokeDasharray="4 3" />
              <circle cx="11" cy="4" r="3" fill="rgb(var(--c-surface))" stroke="rgb(var(--c-subtle))" strokeWidth="1.5" />
            </svg>
            From archived store pages (Internet Archive, Common Crawl)
          </span>
        )}
      </div>

      <table className="w-full text-sm">
        <caption className="sr-only">Lowest, typical and highest price in the range shown</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-subtle">
            <th scope="col" className="py-1 pr-2 font-semibold">{r === "All" ? "All history" : `Last ${r}`}</th>
            <th scope="col" className="py-1 pr-2 font-semibold">Lowest</th>
            <th scope="col" className="py-1 pr-2 font-semibold">Typical</th>
            <th scope="col" className="py-1 font-semibold">Highest</th>
          </tr>
        </thead>
        <tbody>
          {(["new", "used"] as const).map((k) => {
            const s = seriesStats(shown, k);
            if (!s) return null;
            return (
              <tr key={k} className="border-b border-line/60 last:border-0">
                <th scope="row" className="py-1.5 pr-2 text-left font-semibold">{k === "new" ? "New" : "Used"}</th>
                <td className="py-1.5 pr-2 align-top">
                  <span className="price font-semibold">{price(s.low.value, cur)}</span>
                  <span className="block text-[11px] text-subtle">
                    {fmtDay(s.low.day)}
                    {s.low.at ? ` · ${s.low.at}` : ""}
                    {s.low.archived ? " · archived" : ""}
                  </span>
                </td>
                <td className="price py-1.5 pr-2 align-top">{price(s.typical, cur)}</td>
                <td className="py-1.5 align-top">
                  <span className="price">{price(s.high.value, cur)}</span>
                  <span className="block text-[11px] text-subtle">{fmtDay(s.high.day)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {hasArchived && (
        <p className="text-[11px] text-subtle">
          Dashed: prices on copies of the stores&apos; own product pages saved by the Internet Archive and Common Crawl, read the way we read the stores today. They show what a store
          asked on the days a copy was saved, not every day. Solid: prices we recorded ourselves.
        </p>
      )}
    </div>
  );
}
