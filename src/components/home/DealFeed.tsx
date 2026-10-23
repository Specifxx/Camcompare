"use client";
// The home page's deal feed, in the manner of OzBargain (friends' feedback,
// 2026-10-17): one dense row per deal from the deal log (lib/deal-log.ts),
// newest finds and price drops tagged, and deals that sold or expired since
// the last import left in place, greyed and stamped, so a refresh shows what
// got snatched. Rows arrive built from HomeView (links already wrapped with
// affiliateUrl + subId, `paid` decided); this sorts, filters and turns the
// ISO times into "3h ago" against the visitor's clock (the page is static).
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import OutboundLink from "@/components/OutboundLink";
import { retailerButtonClass } from "@/components/OfferRows";
import ProductThumb from "@/components/ProductThumb";
import { price } from "@/lib/format";
import type { Currency, MarketCode } from "@/lib/markets";
import { quickViewAttrs } from "@/lib/quickview";
import DealVotes from "@/components/community/DealVotes";
import { shortAgo } from "./checked-ago";

export type FeedRow = {
  key: string;
  slug: string;
  kind: "camera" | "lens";
  /** "Sony α7S II body" */
  name: string;
  /** "used", "refurbished", "open box", "new" */
  cond: string;
  isNew: boolean;
  store: string;
  price: number;
  rrp: number;
  save: number;
  pct: number;
  was: number | null;
  firstSeen: string;
  droppedAt: string | null;
  gone: { at: string; why: "sold" | "expired" } | null;
  href: string;
  /** The live offer's link, wrapped; null for a gone deal. */
  buy: { href: string; paid: boolean; retailer: string } | null;
  /** Up to 90 days of this condition's daily lowest price, oldest first. */
  spark: number[];
  /** The price is the lowest of at least 14 days of our own history in the last 90. */
  low90: boolean;
};

type Sort = "hot" | "new" | "off";
type Filter = "all" | "used" | "new" | "camera" | "lens";
const PAGE = 30;

const SORTS: [Sort, string][] = [
  ["hot", "Hot"],
  ["new", "New"],
  ["off", "Biggest $ off"],
];
const FILTERS: [Filter, string][] = [
  ["all", "Everything"],
  ["used", "Used"],
  ["new", "New"],
  ["camera", "Cameras"],
  ["lens", "Lenses"],
];

const order: Record<Sort, (a: FeedRow, b: FeedRow) => number> = {
  hot: (a, b) => b.pct - a.pct || b.save - a.save,
  new: (a, b) => b.firstSeen.localeCompare(a.firstSeen) || b.pct - a.pct,
  off: (a, b) => b.save - a.save || b.pct - a.pct,
};
const keep: Record<Filter, (r: FeedRow) => boolean> = {
  all: () => true,
  used: (r) => !r.isNew,
  new: (r) => r.isNew,
  camera: (r) => r.kind === "camera",
  lens: (r) => r.kind === "lens",
};

export default function DealFeed({ rows, m, currency }: { rows: FeedRow[]; m: MarketCode; currency: Currency }) {
  const [sort, setSort] = useState<Sort>("hot");
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const list = useMemo(() => rows.filter(keep[filter]).sort((a, b) => order[sort](a, b) || a.key.localeCompare(b.key)), [rows, sort, filter]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([f]) => [f, rows.filter((r) => !r.gone && keep[f](r)).length])) as Record<Filter, number>, [rows]);
  const goneN = rows.filter((r) => r.gone).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div role="group" aria-label="Sort deals" className="hd-seg">
          {SORTS.map(([s, label]) => (
            <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)} className="hd-seg-btn">
              {label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
          {FILTERS.map(([f, label]) => (
            <button key={f} type="button" aria-pressed={filter === f} disabled={!counts[f]} onClick={() => (setFilter(f), setShown(PAGE))} className="hd-pill">
              {label}
              <span className="ml-1 font-mono text-[10px] opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>
        {goneN > 0 && <span className="text-xs text-subtle">{goneN} snatched or expired in the last 48 hours</span>}
      </div>
      <ol className="border-t border-line">
        {list.slice(0, shown).map((r, i) => (
          <FeedItem key={r.key} r={r} m={m} currency={currency} now={now} i={i} />
        ))}
      </ol>
      {list.length > shown && (
        <p className="mt-3 text-center">
          <button type="button" onClick={() => setShown((n) => n + PAGE)} className="hd-pill px-4 py-1.5">
            Show more deals <span className="ml-1 font-mono text-[10px] opacity-70">{list.length - shown}</span>
          </button>
        </p>
      )}
    </div>
  );
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function Ago({ at, now }: { at: string; now: number | null }) {
  return <time dateTime={at}>{(now !== null && shortAgo(at, now)) || day(at)}</time>;
}

const TAG = "inline-flex items-center rounded border border-line px-1.5 text-[11px] font-medium leading-5 text-muted";

function FeedItem({ r, m, currency, now, i }: { r: FeedRow; m: MarketCode; currency: Currency; now: number | null; i: number }) {
  const gone = r.gone;
  const fresh = now !== null && !gone && now - Date.parse(r.firstSeen) < 6 * 3_600_000;
  const dim = gone ? "opacity-50" : "";
  return (
    <li className="hf-row -mx-2 grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 rounded-md border-b border-line px-2 py-3 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-x-4" style={{ "--i": i } as React.CSSProperties}>
      <Link href={r.href} prefetch={false} {...quickViewAttrs(r.slug, m, r.name)} className={`hf-thumb block ${gone ? "opacity-50 grayscale" : ""}`} tabIndex={-1} aria-hidden>
        <ProductThumb slug={r.slug} alt="" priority={i < 3} />
      </Link>
      <div className={`min-w-0 ${dim}`}>
        <h3 className="text-[0.95rem] font-semibold leading-snug">
          <Link href={r.href} prefetch={false} {...quickViewAttrs(r.slug, m, r.name)} className="text-fg no-underline hover:underline">
            {r.name} — {r.cond} {price(r.price, currency)} at {r.store}{" "}
            <span className="font-normal text-muted">
              (RRP {price(r.rrp, currency)}, save {r.pct}%)
            </span>
          </Link>
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <DealVotes dealKey={voteKey(m, r.key)} />
          <span>{r.store}</span>
          <span aria-hidden>·</span>
          <span className="capitalize">{r.cond}</span>
          <span aria-hidden>·</span>
          <span>
            found <Ago at={r.firstSeen} now={now} />
          </span>
          {fresh && <span className={TAG}>New</span>}
          {r.was !== null && !gone && (
            <span className={TAG} title={r.droppedAt ? `Dropped ${day(r.droppedAt)}` : undefined}>
              Price dropped, was&nbsp;<s>{price(r.was, currency)}</s>
            </span>
          )}
          {r.low90 && !gone && <span className={TAG}>Lowest in 90 days</span>}
        </div>
        <p className="mt-1 flex items-center gap-2 text-xs">
          {r.spark.length >= 2 && <Spark pts={r.spark} />}
          <Link href={`${r.href}#history`} prefetch={false} className="text-muted hover:text-fg">
            Price history
          </Link>
        </p>
      </div>
      <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:min-w-[9rem] sm:flex-col sm:items-end sm:gap-1.5">
        <span className={`hf-save text-left sm:text-right ${dim}`}>
          <span className={`block text-lg font-bold leading-tight ${gone ? "text-muted" : "text-win"}`}>Save {r.pct}%</span>
          <span className="block text-xs text-muted">{price(r.save, currency)} off RRP</span>
        </span>
        {gone ? (
          <span className="flex flex-col items-end gap-1 text-right">
            <span className="rounded border border-line px-1.5 text-[11px] font-semibold uppercase leading-5 tracking-wide text-muted">{gone.why === "sold" ? "Sold" : "Expired"}</span>
            <span className="text-[11px] text-subtle">
              gone <Ago at={gone.at} now={now} />
            </span>
            <Link href={r.href} prefetch={false} className="text-xs">
              Other prices
            </Link>
          </span>
        ) : (
          r.buy && (
            <span className="text-center">
              <OutboundLink href={r.buy.href} retailer={r.buy.retailer} product={r.slug} placement="home-feed" className={`${retailerButtonClass(r.buy.retailer, r.buy.paid)} whitespace-nowrap px-4`}>
                Go to deal
              </OutboundLink>
              {r.buy.paid && <span className="mt-0.5 block text-[10px] leading-none text-subtle">Paid link</span>}
            </span>
          )
        )}
      </div>
    </li>
  );
}

// The deal log's key ("slug|condition|retailer") in the vote API's alphabet.
// Stable across builds, so a deal keeps its votes from one import to the next.
export const voteKey = (m: MarketCode, key: string) => `${m}:${key}`.toLowerCase().replace(/\|/g, ":").replace(/[^a-z0-9:_.-]/g, "-").slice(0, 120);

function Spark({ pts }: { pts: number[] }) {
  const W = 64,
    H = 18;
  const lo = Math.min(...pts),
    hi = Math.max(...pts);
  const span = hi - lo || 1;
  const xy = pts.map((v, i) => `${((i / (pts.length - 1)) * (W - 2) + 1).toFixed(1)},${(H - 2 - ((v - lo) / span) * (H - 4)).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Price over the last ${pts.length} days`} className="shrink-0">
      <polyline fill="none" stroke="rgb(var(--c-subtle))" strokeWidth="1.25" points={xy.join(" ")} />
    </svg>
  );
}
