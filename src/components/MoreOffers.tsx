"use client";
// "Show N more prices" under a product's store table. The extra rows (more
// kits, out-of-stock listings) used to ship in every product page's HTML and
// RSC payload, half of it on a page like the α7 IV's: 70 rows nobody opened,
// read from the ISR cache on every request. Now the page sends their ids and
// the rows come from the quick view's static file (public/offers/<market>/
// <slug>.json, the same rows, already affiliate-wrapped) on first open.
// Amazon rows are never in that file, so the page passes any of those itself
// (lib/offers reads the disk, so its AMAZON_MAX_AGE_H comes in as a prop).
import { useState } from "react";
import type { MarketCode } from "@/lib/markets";
import { price } from "@/lib/format";
import { quickViewFile, type OfferRow } from "@/lib/quickview";
import { OfferRowItem } from "./OfferRows";
import TimedPrice from "./TimedPrice";

type Props = { market: MarketCode; product: string; ids: string[]; inline: OfferRow[]; outOfStock: boolean; rrp: number | null; usedTypical: number | null; amazonMaxAgeH: number };

export default function MoreOffers({ market, product, ids, inline, outOfStock, rrp, usedTypical, amazonMaxAgeH }: Props) {
  const [rows, setRows] = useState<OfferRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = () => {
    if (rows || failed) return;
    fetch(quickViewFile(market, product))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { rows?: OfferRow[] }) => {
        const byId = new Map([...(d.rows ?? []), ...inline].map((r) => [r.id, r]));
        setRows(ids.map((id) => byId.get(id)).filter((r): r is OfferRow => !!r));
      })
      .catch(() => setFailed(true));
  };
  return (
    <details className="group mt-2" onToggle={(e) => (e.currentTarget.open ? load() : undefined)}>
      <summary className="cursor-pointer text-sm font-medium text-accent">
        Show {ids.length} more {ids.length === 1 ? "price" : "prices"}
        {outOfStock ? ", out of stock included" : ""}
      </summary>
      {rows ? (
        <ul className="card mt-2 divide-y divide-line">
          {rows.map((r) => (
            <OfferRowItem key={r.id} row={r} product={product} placement="offers" rrp={rrp} usedTypical={usedTypical} priceNode={r.amazon && r.seenAt ? <TimedPrice text={price(r.price, r.currency)} seenAt={r.seenAt} maxAgeH={amazonMaxAgeH} /> : undefined} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">{failed ? "Couldn't load the other prices. Refresh the page to try again." : "Loading…"}</p>
      )}
    </details>
  );
}
