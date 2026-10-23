"use client";
// The filters over "Where to buy" and the rows beyond the first few.
// OffersTable renders the first rows of every filter once; this sets the
// wrapper's data-tab (rows hide by CSS, lib/offer-tabs.ts) and, on "Show N
// more", loads the rest from the product's static quick-view file
// (public/offers/<market>/<slug>.json, links already affiliate-wrapped at
// build), so the page itself stays light. That file never has Amazon's price;
// Amazon's row, when there is one, is always among the first rows.
import { useState } from "react";
import type { MarketCode } from "@/lib/markets";
import { rowInTab, type OfferTab } from "@/lib/offer-tabs";
import { quickViewFile, type OfferRow, type QuickViewData } from "@/lib/quickview";
import { OfferRowItem } from "./OfferRows";

type Tab = { key: OfferTab; label: string; count: number; more: number };

export default function OfferTabs({
  tabs,
  initial,
  slug,
  market,
  shown,
  rrp,
  usedTypical,
  kitWord,
  body,
  kits,
  footer,
}: {
  tabs: Tab[];
  initial: OfferTab;
  slug: string;
  market: MarketCode;
  /** Row ids already in the HTML. */
  shown: string[];
  rrp: number | null;
  usedTypical: number | null;
  kitWord: string;
  /** The server-rendered body-only rows and kit rows (with its heading). */
  body: React.ReactNode;
  kits: React.ReactNode;
  /** Server-rendered, after the rows: the Used filter's eBay search (hidden under the other filters by CSS). */
  footer?: React.ReactNode;
}) {
  const [tab, setTab] = useState<OfferTab>(initial);
  const [extra, setExtra] = useState<OfferRow[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  const cur = tabs.find((t) => t.key === tab) ?? tabs[0];

  const loadMore = async () => {
    setState("loading");
    try {
      const r = await fetch(quickViewFile(market, slug));
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as QuickViewData;
      const have = new Set(shown);
      // Tags belong to the page's own headline rows, already shown.
      setExtra(d.rows.filter((x) => !have.has(x.id)).map(({ tag: _t, ...x }) => x));
      setState("idle");
    } catch {
      setState("failed");
    }
  };

  const more = extra?.filter((r) => rowInTab(r, tab)) ?? [];
  const moreBody = more.filter((r) => !r.kit);
  const moreKits = more.filter((r) => r.kit);
  const row = (r: OfferRow) => <OfferRowItem key={r.id} row={r} product={slug} placement="offers-more" rrp={rrp} usedTypical={usedTypical} />;

  return (
    <div>
      {tabs.length > 2 && (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Show offers">
          {tabs.map((t) => (
            <button key={t.key} type="button" className="hd-pill shrink-0" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
              <span className="ml-1.5 text-xs font-normal text-subtle">{t.count}</span>
            </button>
          ))}
        </div>
      )}
      <div data-tab={tab} className="group/o flex flex-col gap-4">
        {body}
        {moreBody.length > 0 && <ul className="card divide-y divide-line overflow-hidden">{moreBody.map(row)}</ul>}
        {kits}
        {moreKits.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-sm font-bold text-muted">More {kitWord.startsWith("Kits:") ? "kits" : "kits and bundles"}</h3>
            <ul className="card divide-y divide-line overflow-hidden">{moreKits.map(row)}</ul>
          </div>
        )}
        {footer}
      </div>
      {!extra && cur && cur.more > 0 && (
        <button type="button" onClick={loadMore} disabled={state === "loading"} className="mt-3 text-sm font-semibold text-accent hover:underline disabled:opacity-60">
          {state === "loading" ? "Loading…" : state === "failed" ? "Couldn't load them. Try again" : `Show ${cur.more} more ${cur.more === 1 ? "price" : "prices"}`}
        </button>
      )}
    </div>
  );
}
