// The deals board: the same prices as the rest of the site, as a plain HTML
// page (owner feedback, 2026-10-17: "looks HTML coded, no JavaScript, just
// real deals"). A server component, no images and no animation; the one
// client component is OutboundLink (CLAUDE.md: every retailer link), which
// server-renders a plain <a rel="sponsored"> that works with JS off: tables, Times, blue underlined links. Its own small ranking
// lives here on purpose (src/lib/insights.ts is someone else's file).
//
// It still sits inside the site's root layout: a second root layout needs
// every other route moved into a route group of its own, so the header and
// footer (and their JS) still come with it. Noindex: the same deals as /deals.
import type { Metadata } from "next";
import { displayName, historyFor, launchPrice, offersFor, offersGeneratedAt, publishedCameras, publishedLenses, type AnyProduct } from "@/lib/catalog";
import OutboundLink from "@/components/OutboundLink";
import { affiliateUrl, isPaid, subId } from "@/lib/affiliate";
import { price } from "@/lib/format";
import { MARKET_CODES, MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { lowest, type Offer } from "@/lib/offers";
import { CONDITION_LABEL, retailer } from "@/lib/retailers";
import { pageMeta } from "@/lib/seo";
import { usedValue } from "@/lib/value";

const LIMIT = 30;

type Row = { p: AnyProduct; o: Offer; ref: number | null; pct: number | null };

const all = (): AnyProduct[] => [
  ...publishedCameras().map((item) => ({ kind: "camera" as const, item })),
  ...publishedLenses().map((item) => ({ kind: "lens" as const, item })),
];

const pctBelow = (now: number, ref: number) => Math.round((1 - now / ref) * 100);

/** Lowest new price against the launch price (RRP), biggest cut first. */
function rrpDrops(m: MarketCode): Row[] {
  return all()
    .flatMap((p) => {
      const o = lowest(offersFor(p.item.slug, m), "new");
      const lp = launchPrice(p.item, m);
      if (!o || !lp || lp.currency !== o.currency) return [];
      const ref = Math.round(lp.amount * 100);
      const pct = pctBelow(o.price, ref);
      // Under 5% is noise; over 80% is a mismatch, not a deal.
      return pct >= 5 && pct <= 80 ? [{ p, o, ref, pct }] : [];
    })
    .sort((a, b) => b.pct! - a.pct!)
    .slice(0, LIMIT);
}

/** Cheapest used offer against the typical used asking price of the last 90 days. */
function usedBelowTypical(m: MarketCode): Row[] {
  return all()
    .flatMap((p) => {
      const o = lowest(offersFor(p.item.slug, m), "used");
      const v = usedValue(historyFor(p.item.slug, m));
      if (!o || !v || o.currency !== MARKETS[m].currency) return [];
      const pct = pctBelow(o.price, v.value);
      return pct >= 5 && pct <= 70 ? [{ p, o, ref: v.value, pct }] : [];
    })
    .sort((a, b) => b.pct! - a.pct!)
    .slice(0, LIMIT);
}

/** "Popular" = the bodies the most shops in this market list today; cheapest offer of any condition. */
function popularBodies(m: MarketCode): Row[] {
  return publishedCameras()
    .flatMap((item) => {
      const offers = offersFor(item.slug, m);
      const shops = new Set(offers.filter((o) => o.inStock && !o.kit).map((o) => o.retailer)).size;
      const n = lowest(offers, "new");
      const u = lowest(offers, "used");
      const o = n && u ? (u.price < n.price ? u : n) : (n ?? u);
      const p: AnyProduct = { kind: "camera", item };
      return o && shops >= 2 ? [{ p, o, shops }] : [];
    })
    .sort((a, b) => b.shops - a.shops || a.p.item.name.localeCompare(b.p.item.name))
    .slice(0, LIMIT)
    .sort((a, b) => a.o.price - b.o.price)
    .map(({ p, o }) => ({ p, o, ref: null, pct: null }));
}

export function boardMetadata(m: MarketCode): Metadata {
  return pageMeta({
    title: "Deals board (plain HTML)",
    description: `Camera and lens deals in ${MARKETS[m].name} as one plain table: biggest cuts from launch price, cheap used copies, the cheapest popular bodies.`,
    path: "/board",
    market: m,
    index: false,
  });
}

const CSS = `
.raw{font-family:"Times New Roman",Times,serif;font-size:16px;line-height:1.3;color:#000;background:#fff;padding:8px}
.raw h1{font-size:2em;font-weight:bold;margin:.67em 0}
.raw h2{font-size:1.5em;font-weight:bold;margin:1em 0 .4em}
.raw p{margin:.5em 0}
.raw a{color:#00e;text-decoration:underline}
.raw a:visited{color:#551a8b}
.raw table{border-collapse:separate;border-spacing:2px;border:1px solid #808080}
.raw th,.raw td{border:1px solid #808080;padding:2px 4px;vertical-align:top}
.raw th{font-weight:bold;text-align:left;background:#ddd}
.raw td.n{text-align:right;white-space:nowrap}
.raw hr{border:0;border-top:1px solid #808080;margin:1em 0}
.raw .scroll{overflow-x:auto}
`;

function Table({ rows, m, placement, refLabel }: { rows: Row[]; m: MarketCode; placement: string; refLabel?: string }) {
  const cur = MARKETS[m].currency;
  if (!rows.length) return <p><i>Nothing here yet.</i></p>;
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Product</th>
            <th>Store</th>
            <th>Condition</th>
            <th>Price</th>
            {refLabel && <th>{refLabel}</th>}
            {refLabel && <th>Off</th>}
            <th>Link</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, o, ref, pct }, i) => {
            const href = affiliateUrl(o.retailer, o.url, subId("board", `${placement}-${p.item.slug}`));
            const page = marketPath(m, `/${p.kind === "camera" ? "cameras" : "lenses"}/${p.item.slug}`);
            return (
              <tr key={p.item.slug}>
                <td className="n">{i + 1}</td>
                <td>
                  <a href={page}>{displayName(p.item, m)}</a>
                </td>
                <td>{retailer(o.retailer)?.name ?? o.retailer}{o.seller ? ` (${o.seller})` : ""}</td>
                <td>{CONDITION_LABEL[o.condition]}</td>
                <td className="n"><b>{price(o.price, cur)}</b></td>
                {refLabel && <td className="n">{ref !== null ? price(ref, cur) : ""}</td>}
                {refLabel && <td className="n">{pct !== null ? `-${pct}%` : ""}</td>}
                <td>
                  <OutboundLink href={href} retailer={o.retailer} product={p.item.slug} placement={`board-${placement}`}>buy</OutboundLink>
                </td>
                <td>{isPaid(o.retailer, href) ? "Paid link" : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function BoardView({ market: m }: { market: MarketCode }) {
  const updated = offersGeneratedAt(m);
  return (
    <div className="raw">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <h1>Deals board: {MARKETS[m].name}</h1>
      <p>
        Plain list. No sponsored spots, every table sorted by the deal itself. Prices in {MARKETS[m].currency}, in stock, body or lens only (no kits), Amazon left out.
        {updated ? ` Prices checked ${new Date(updated).toUTCString().slice(5, 22)} UTC.` : ""}
      </p>
      <p>
        Other markets:{" "}
        {MARKET_CODES.filter((c) => c !== m).map((c, i) => (
          <span key={c}>
            {i > 0 && " | "}
            <a href={marketPath(c, "/board")}>{MARKETS[c].name}</a>
          </span>
        ))}
        {" | "}
        <a href={marketPath(m, "/deals")}>the normal deals page</a>
      </p>
      <hr />
      <h2>Biggest drops vs RRP</h2>
      <p>Lowest new price today against the maker&apos;s launch price.</p>
      <Table rows={rrpDrops(m)} m={m} placement="rrp" refLabel="RRP" />
      <h2>Cheapest used vs typical used price</h2>
      <p>Cheapest used, refurbished or open-box copy against the typical used asking price of the last 90 days.</p>
      <Table rows={usedBelowTypical(m)} m={m} placement="used" refLabel="Typical used" />
      <h2>Cheapest of each popular body</h2>
      <p>The {LIMIT} camera bodies the most shops here list, cheapest first, new or used.</p>
      <Table rows={popularBodies(m)} m={m} placement="bodies" />
      <hr />
      <p>
        <small>
          &quot;Paid link&quot;: we earn a commission if you buy through it, at no cost to you. It never changes the order. <a href="/disclosure">Disclosure</a>.
        </small>
      </p>
    </div>
  );
}
