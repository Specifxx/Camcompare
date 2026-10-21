"use client";
// One product line's global price table (/world/<brand>/<line>): the US list
// price and today's lowest new price in each market, all converted into the
// currency the visitor picks (USD first), each labelled ≈ and with the
// market's own price under it. The cheapest market per row is green, and the
// last column is the most it saves against the US list price.
// Converted figures appear only here and in "Price around the world"
// (DECISIONS "Global price comparison page").
import Link from "next/link";
import { useEffect, useState } from "react";
import { money } from "@/lib/markets";
import { convertAt, liveColumns, rowBest, type WorldTableData } from "@/lib/world-table";

const PICK = ["USD", "GBP", "EUR", "AUD", "SGD"] as const;
const KEY = "cc_world_currency";
// Whole units: a converted figure is approximate, cents would claim otherwise.
const approx = (minor: number, cur: string) => money(Math.round(minor / 100), cur as (typeof PICK)[number]);

/** The picker, shared by every table on the page through localStorage and an event. */
export function useWorldCurrency(): [string, (c: string) => void] {
  const [cur, setCur] = useState<string>("USD");
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v && (PICK as readonly string[]).includes(v)) setCur(v);
    } catch {}
    const on = (e: Event) => setCur((e as CustomEvent<string>).detail);
    window.addEventListener(KEY, on);
    return () => window.removeEventListener(KEY, on);
  }, []);
  const set = (c: string) => {
    try {
      localStorage.setItem(KEY, c);
    } catch {}
    window.dispatchEvent(new CustomEvent(KEY, { detail: c }));
  };
  return [cur, set];
}

export function WorldCurrencyPicker({ date }: { date: string | null }) {
  const [cur, set] = useWorldCurrency();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor="world-cur" className="font-semibold">
        Show prices in
      </label>
      <select id="world-cur" value={cur} onChange={(e) => set(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1 text-base sm:text-sm">
        {PICK.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <span className="text-xs text-subtle">≈ at today&apos;s exchange rate{date ? ` (ECB reference rates, ${date})` : ""}</span>
    </div>
  );
}

export default function WorldTable({ data, rates }: { data: WorldTableData; rates: Record<string, number> }) {
  const [cur] = useWorldCurrency();
  const cols = liveColumns();
  if (!data.rows.length) return null;
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">
          {data.line.name}: US list price and today&apos;s lowest new price in each market, converted into {cur} at today&apos;s exchange rate
        </caption>
        <thead>
          <tr className="border-b border-line bg-raised/60 text-left text-xs text-subtle">
            <th scope="col" className="sticky left-0 bg-raised p-2 font-semibold">Product</th>
            <th scope="col" className="p-2 font-semibold">US list</th>
            {cols.map((c) => (
              <th key={c.key} scope="col" className="p-2 font-semibold">
                <span aria-hidden>{c.flag} </span>
                {c.label}
              </th>
            ))}
            <th scope="col" className="p-2 font-semibold">Max saving vs US list</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => {
            const best = rowBest(r, cur, rates);
            return (
              <tr key={r.slug} className="border-b border-line/60 last:border-0">
                <th scope="row" className="sticky left-0 w-32 bg-surface p-2 text-left text-xs font-semibold sm:w-auto sm:text-sm">
                  <Link href={r.path} prefetch={false} className="text-fg">
                    {r.name}
                  </Link>
                </th>
                <td className="price p-2 align-top">{r.listUsd ? <span>≈ {approx(convertAt(r.listUsd * 100, "USD", cur, rates), cur)}</span> : <span className="text-subtle">—</span>}
                  {r.listUsd && cur !== "USD" ? <span className="block text-[11px] text-subtle">{money(r.listUsd, "USD")}</span> : null}
                </td>
                {cols.map((c) => {
                  const cell = r.cells[c.key];
                  const win = best?.key === c.key;
                  return (
                    <td key={c.key} className={`price p-2 align-top ${win ? "bg-buy-soft" : ""}`}>
                      {cell ? (
                        <>
                          <span className={win ? "font-bold text-win" : "font-semibold"}>
                            {cell.currency === cur ? money(cell.price, cell.currency, true) : `≈ ${approx(convertAt(cell.price, cell.currency, cur, rates), cur)}`}
                          </span>
                          {cell.currency !== cur && <span className="block text-[11px] text-subtle">{money(cell.price, cell.currency, true)}</span>}
                          <span className="block text-[11px] text-subtle">{cell.store}</span>
                        </>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="price p-2 align-top">
                  {best && best.saving !== null && best.pct !== null && best.pct >= 1 ? (
                    <>
                      <span className="font-bold text-win">≈ {approx(best.saving, cur)}</span>
                      <span className="block text-[11px] text-subtle">
                        {best.pct}% · {cols.find((c) => c.key === best.key)?.label}
                      </span>
                    </>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
