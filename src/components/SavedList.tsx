"use client";
// The visitor's saved cameras and lenses, with today's price and the change
// since they saved it. Everything comes from static files (/search-index.json,
// /prices/<market>.json) and this browser's localStorage.
import Link from "next/link";
import { useEffect, useState } from "react";
import { price } from "@/lib/format";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { readSaved, savedChange, writeSaved, type SavedItem } from "@/lib/saved";
import type { SearchRow } from "@/lib/search";
import { decodeSavedList, encodeSavedList } from "@/lib/share-link";
import ShareButton from "./ShareButton";

export default function SavedList({ market }: { market: MarketCode }) {
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [names, setNames] = useState<Record<string, SearchRow>>({});
  const [prices, setPrices] = useState<Record<string, [number | null, number | null]>>({});
  const [stores, setStores] = useState<Record<string, [string | null, string | null]>>({});
  // A list someone shared (/saved?i=…, lib/share-link.ts): shown read-only, never written over the visitor's own
  // until they choose "Save these to my list". /saved is noindex either way.
  const [shared, setShared] = useState(false);
  useEffect(() => {
    const fromLink = decodeSavedList(location.search);
    if (fromLink) {
      setShared(true);
      setItems(fromLink.map((x) => ({ ...x, market, at: "", seen: null })));
    } else setItems(readSaved());
    fetch("/search-index.json").then((r) => r.json()).then((rows: SearchRow[]) => setNames(Object.fromEntries(rows.map((r) => [r.s, r])))).catch(() => {});
    fetch(`/prices/${market}.json`).then((r) => r.json()).then((d: { p: Record<string, [number | null, number | null]>; s?: Record<string, [string | null, string | null]> }) => {
        setPrices(d.p);
        setStores(d.s ?? {});
      }).catch(() => {});
  }, [market]);
  if (items === null) return null;
  if (!items.length) return <p className="card p-6 text-sm text-muted">Nothing saved yet. Use the Save button on any camera or lens page; the list stays in this browser.</p>;
  const cur = MARKETS[market].currency;
  const keep = () => {
    const mine = readSaved();
    const have = new Set(mine.map((x) => x.slug));
    writeSaved([...mine, ...(items ?? []).filter((x) => !have.has(x.slug)).map((x) => ({ ...x, at: new Date().toISOString(), seen: prices[x.slug]?.[0] ?? null, cond: "new" as const }))]);
    setShared(false);
    setItems(readSaved());
    history.replaceState(null, "", location.pathname);
  };
  return (
    <>
    {shared ? (
      <p className="card mb-3 px-4 py-3 text-sm">
        Someone shared this list with you.{" "}
        <button type="button" onClick={keep} className="font-semibold text-accent underline">
          Save these to my list
        </button>
      </p>
    ) : (
      <div className="mb-3">
        <ShareButton title="My camera list" path={`${marketPath(market, "/saved")}?i=${encodeSavedList(items)}`} medium="list" label="Share this list" text={`My camera and lens list, with each one's lowest price on ${"CamCompare"}:`} />
      </div>
    )}
    <ul className="card divide-y divide-line">
      {items.map((it) => {
        const row = names[it.slug];
        const { now, cond, delta } = savedChange(it, prices[it.slug], market);
        return (
          <li key={it.slug} className="flex items-center gap-3 px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/products/${it.slug}.webp`} alt="" width={64} height={48} className="h-12 w-16 shrink-0 rounded bg-white object-contain" />
            <Link href={marketPath(market, `/${it.kind === "c" ? "cameras" : "lenses"}/${it.slug}`)} className="min-w-0 flex-1 truncate font-semibold">
              {row?.n ?? it.slug}
            </Link>
            <span className="shrink-0 text-right text-sm">
              {now !== null ? <span className="price font-bold">{price(now, cur)}</span> : <span className="text-subtle">no price</span>}
              {cond === "used" && <span className="text-xs text-subtle"> used</span>}
              {now !== null && stores[it.slug]?.[cond === "used" ? 1 : 0] && <span className="block text-xs text-subtle">at {stores[it.slug]![cond === "used" ? 1 : 0]}</span>}
              {delta !== null && delta !== 0 && (
                <span className={`block text-xs ${delta < 0 ? "text-win" : "text-warn"}`}>
                  {delta < 0 ? "▼" : "▲"} {price(Math.abs(delta), cur)} since saved
                </span>
              )}
            </span>
            {!shared && <button type="button" className="text-xs text-muted" onClick={() => setItems((s) => { const next = (s ?? []).filter((x) => x.slug !== it.slug); writeSaved(next); return next; })} aria-label={`Remove ${row?.n ?? it.slug}`}>
              Remove
            </button>}
          </li>
        );
      })}
    </ul>
    </>
  );
}
