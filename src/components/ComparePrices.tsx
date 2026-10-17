"use client";
// The "lowest price today" cells of a comparison. Server-rendered for the
// page's market; on the market-independent /compare/<a>-vs-<b> pages a
// visitor who chose another market sees that market's prices instead,
// fetched from /prices/<market>.json (built with the site).
import { useEffect, useState } from "react";
import { price } from "@/lib/format";
import { MARKETS, type Currency, type MarketCode } from "@/lib/markets";
import { rememberedMarket } from "@/lib/market-client";

type Cell = { n: number | null; u: number | null };

export default function ComparePrices({ slugs, market, initial, follow }: { slugs: string[]; market: MarketCode; initial: Cell[]; follow: boolean }) {
  const [state, setState] = useState<{ m: MarketCode; cells: Cell[] }>({ m: market, cells: initial });
  useEffect(() => {
    if (!follow) return;
    const want = rememberedMarket();
    if (!want || want === market) return;
    fetch(`/prices/${want}.json`)
      .then((r) => r.json())
      .then((d: { p: Record<string, [number | null, number | null]> }) => setState({ m: want, cells: slugs.map((s) => ({ n: d.p[s]?.[0] ?? null, u: d.p[s]?.[1] ?? null })) }))
      .catch(() => {});
  }, [follow, market, slugs]);
  const cur: Currency = MARKETS[state.m].currency;
  return (
    <>
      {state.cells.map((c, i) => (
        <td key={slugs[i]} className="p-3 align-top">
          {c.n !== null && <p><span className="price font-bold text-buy">{price(c.n, cur)}</span> <span className="text-xs text-subtle">new</span></p>}
          {c.u !== null && <p><span className="price font-semibold">{price(c.u, cur)}</span> <span className="text-xs text-subtle">used</span></p>}
          {c.n === null && c.u === null && <p className="text-xs text-subtle">Not priced in {MARKETS[state.m].short} yet</p>}
        </td>
      ))}
    </>
  );
}
