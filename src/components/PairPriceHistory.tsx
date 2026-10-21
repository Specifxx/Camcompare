"use client";
// Two products' lowest new price on one chart, for /compare/<a>-vs-<b> and
// the deals page's "price traps": does the newer model really cost less?
// Flags it when the newer one costs more today than the older one (often on
// promotion). Fetches both products' static history files
// (lib/history-chart.ts); on the global pair pages it follows the visitor's
// market, as the price cells do (ComparePrices).
import Link from "next/link";
import { useEffect, useState } from "react";
import HistoryChart, { type ChartSeries } from "@/components/HistoryChart";
import { price } from "@/lib/format";
import { decodeHistory, historyJsonPath, type HistoryJson } from "@/lib/history-chart";
import { useVisitorMarket } from "@/lib/market-client";
import { MARKETS, type MarketCode } from "@/lib/markets";

type Side = { slug: string; name: string; announced: string };
type Loaded = { m: MarketCode; a: ReturnType<typeof decodeHistory> | null; b: ReturnType<typeof decodeHistory> | null };
const COLORS = ["rgb(var(--c-accent))", "rgb(var(--c-win))"];

export default function PairPriceHistory({ a, b, market, pairPath }: { a: Side; b: Side; market?: MarketCode; pairPath?: string }) {
  const visitor = useVisitorMarket();
  const m: MarketCode = market ?? visitor ?? "us";
  const [data, setData] = useState<Loaded | null>(null);
  useEffect(() => {
    let live = true;
    const get = (s: string) =>
      fetch(historyJsonPath(m, s))
        .then((r) => (r.ok ? (r.json() as Promise<HistoryJson>) : null))
        .then((j) => (j ? decodeHistory(j) : null))
        .catch(() => null);
    Promise.all([get(a.slug), get(b.slug)]).then(([x, y]) => live && setData({ m, a: x, b: y }));
    return () => {
      live = false;
    };
  }, [m, a.slug, b.slug]);

  if (!data) return <div className="h-[260px] animate-pulse rounded-lg bg-raised/60" aria-busy="true" aria-label="Loading price history" />;
  const sides = [
    { s: a, h: data.a },
    { s: b, h: data.b },
  ];
  const series: ChartSeries[] = sides
    .map(({ s, h }, i) => ({
      key: s.slug,
      label: s.name,
      color: COLORS[i],
      points: (h?.days ?? []).filter((d) => d.new !== undefined).map((d) => ({ day: d.day, v: d.new!, at: d.newAt, archived: d.archived })),
    }))
    .filter((s) => s.points.length);
  const cur = MARKETS[data.m].currency;
  const [older, newer] = a.announced <= b.announced ? [sides[0], sides[1]] : [sides[1], sides[0]];
  const tn = newer.h?.today.new ?? null;
  const to = older.h?.today.new ?? null;
  const trap = tn !== null && to !== null && tn > to ? { diff: tn - to, pct: Math.round(((tn - to) / to) * 100) } : null;
  const days = series.flatMap((s) => s.points.map((p) => p.day)).sort();
  const archived = series.some((s) => s.points.some((p) => p.archived));

  return (
    <div className="flex flex-col gap-3">
      {trap && trap.pct >= 3 ? (
        <p className="rounded-lg border border-warn/40 bg-raised/50 p-3 text-sm">
          <strong className="text-warn">Price trap:</strong> the newer <strong>{newer.s.name}</strong> costs {price(trap.diff, cur)} ({trap.pct}%) more than the older{" "}
          <strong>{older.s.name}</strong> today in {MARKETS[data.m].name} ({price(tn!, cur)} against {price(to!, cur)}
          {older.h?.today.newAt ? ` at ${older.h.today.newAt}` : ""}). Newer isn&apos;t always cheaper; check the specs you&apos;d actually use.
        </p>
      ) : tn !== null && to !== null ? (
        <p className="text-sm text-muted">
          Today in {MARKETS[data.m].name}: {newer.s.name} {price(tn, cur)}, {older.s.name} {price(to, cur)} (lowest new).
        </p>
      ) : null}
      {series.length && days.length > 1 ? (
        <>
          <HistoryChart series={series} currency={cur} from={days[0]} to={days[days.length - 1]} height={220} label={`Lowest new price per day: ${a.name} and ${b.name}`} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {series.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <span aria-hidden className="inline-block w-4 border-t-2" style={{ borderColor: s.color }} />
                {s.label} (lowest new)
              </span>
            ))}
            {archived && (
              <span className="inline-flex items-center gap-1.5">
                <svg aria-hidden width="22" height="8">
                  <line x1="0" x2="22" y1="4" y2="4" stroke="rgb(var(--c-subtle))" strokeWidth="2" strokeDasharray="4 3" />
                  <circle cx="11" cy="4" r="3" fill="rgb(var(--c-surface))" stroke="rgb(var(--c-subtle))" strokeWidth="1.5" />
                </svg>
                From archived store pages (Internet Archive, Common Crawl)
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">Not enough price history in {MARKETS[data.m].name} yet to chart these two side by side.</p>
      )}
      {pairPath && (
        <p className="text-sm">
          <Link href={pairPath} prefetch={false}>
            Compare the specs →
          </Link>
        </p>
      )}
    </div>
  );
}
