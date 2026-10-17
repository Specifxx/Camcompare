"use client";
// The "lowest price today" cells of a comparison. Server-rendered for the
// page's market; on the market-independent /compare/<a>-vs-<b> pages a
// visitor in another market sees that market's prices instead, fetched from
// /prices/<market>.json (built with the site), and again whenever they switch.
import Link from "next/link";
import { useEffect, useState } from "react";
import { price } from "@/lib/format";
import { MARKETS, marketPath, type Currency, type MarketCode } from "@/lib/markets";
import { useVisitorMarket } from "@/lib/market-client";

type Cell = { n: number | null; u: number | null };

export default function ComparePrices({ slugs, market, initial, follow }: { slugs: string[]; market: MarketCode; initial: Cell[]; follow: boolean }) {
  const [state, setState] = useState<{ m: MarketCode; cells: Cell[] }>({ m: market, cells: initial });
  const want = useVisitorMarket();
  useEffect(() => {
    if (!follow) return;
    if (!want || want === market) {
      setState((s) => (s.m === market ? s : { m: market, cells: initial }));
      return;
    }
    let live = true; // a quicker switch after this one wins
    fetch(`/prices/${want}.json`)
      .then((r) => r.json())
      .then((d: { p: Record<string, [number | null, number | null]> }) => {
        if (live) setState({ m: want, cells: slugs.map((s) => ({ n: d.p[s]?.[0] ?? null, u: d.p[s]?.[1] ?? null })) });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [follow, want, market, slugs, initial]);
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

/**
 * A link from a global page into a market page, in the visitor's market:
 * `/compare?c=a,b` is `/uk/compare?c=a,b` for a visitor shopping in the UK.
 * The server renders the US link; it changes after mount.
 */
export function FollowLink({ path, children, className }: { path: string; children: React.ReactNode; className?: string }) {
  const m = useVisitorMarket() ?? "us";
  return (
    <Link href={marketPath(m, path)} prefetch={false} className={className}>
      {children}
    </Link>
  );
}
