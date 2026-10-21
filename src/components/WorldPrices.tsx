import Link from "next/link";
import { offersFor, product } from "@/lib/catalog";
import { price } from "@/lib/format";
import { readFx } from "@/lib/fx";
import { worldRows, worldVerdict } from "@/lib/insights";
import { MARKET_CODES, MARKETS, marketPath, type Currency, type MarketCode } from "@/lib/markets";
import type { Offer } from "@/lib/offers";
import { packKind } from "@/lib/offer-rows";
import { kitText } from "@/lib/price-rules";

/**
 * "Price around the world": each market's lowest new and used price in its
 * own currency, and beside it an approximate conversion into this page's
 * currency, labelled as such. The ONE place a converted figure appears
 * (DECISIONS 2026-10-17, "Price around the world"); every other price on the
 * site stays in its own currency. The same rules as the table above it
 * (lib/price-rules.ts): in stock, body only, Amazon left out; where a
 * condition has kits only, its cheapest kit shows, labelled "kit", and is
 * never compared as the body price.
 */
export default function WorldPrices({ slug, path, market: here, name }: { slug: string; path: string; market: MarketCode; name: string }) {
  const fx = readFx();
  const byMarket = Object.fromEntries(MARKET_CODES.map((m) => [m, offersFor(slug, m)])) as Record<MarketCode, Offer[]>;
  const p = product(slug);
  const pack = p ? packKind(p) : "lens";
  const rows = worldRows(byMarket, here, fx, (o) => kitText(o, pack));
  if (!rows.some((r) => r.new !== null || r.used !== null || r.newKit || r.usedKit)) return null;
  const verdict = worldVerdict(rows, here);
  const cur = MARKETS[here].currency;
  const approx = (v: number | null, same: boolean) => (v === null || same ? null : <span className="block text-[11px] text-subtle">≈ {price(Math.round(v / 100) * 100, cur)}</span>);
  return (
    <section id="world-prices">
    <h2 className="h-section mb-3">Price around the world</h2>
    <div className="card flex flex-col gap-3 p-4">
      {verdict && <p className="font-semibold">{verdict.text}</p>}
      <p className="text-xs text-muted">Prices are in each market&apos;s own currency. Under each: ≈ in {cur} at today&apos;s exchange rate. Body only; where a market lists only kits, its cheapest kit is shown and marked.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Lowest new and used price of the {name} in each market, with an approximate conversion into {cur}</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-subtle">
              <th scope="col" className="py-1.5 pr-3 font-semibold">Market</th>
              <th scope="col" className="py-1.5 pr-3 font-semibold">Lowest new</th>
              <th scope="col" className="py-1.5 font-semibold">Lowest used/refurb</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const same = r.currency === cur;
              const best = verdict && verdict.cheapest === r.market;
              return (
                <tr key={r.market} className={`border-b border-line/60 last:border-0 ${r.market === here ? "bg-raised/60" : ""}`}>
                  <th scope="row" className="py-2 pr-3 text-left font-semibold">
                    <Link href={marketPath(r.market, path)} prefetch={false} className="text-fg">
                      <span aria-hidden>{MARKETS[r.market].flag} </span>
                      {MARKETS[r.market].name}
                    </Link>
                    {r.market === here && <span className="ml-1 text-[11px] font-normal text-subtle">(you)</span>}
                    {best && <span className="ml-1 rounded-full bg-buy-soft px-1.5 py-0.5 text-[11px] font-semibold text-win">Cheapest</span>}
                  </th>
                  <td className="price py-2 pr-3 align-top">
                    <Cell value={r.new} kit={r.newKit ?? null} currency={r.currency} listed={Boolean(r.listed)} />
                    {approx(r.new !== null ? r.newHere : r.newKit?.here ?? null, same)}
                  </td>
                  <td className="price py-2 align-top">
                    <Cell value={r.used} kit={r.usedKit ?? null} currency={r.currency} listed={Boolean(r.listed)} />
                    {approx(r.used !== null ? r.usedHere : r.usedKit?.here ?? null, same)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-subtle">
        Each price is in its own currency, as the store charges it. The ≈ figures are approximate, at today&apos;s exchange rate
        {fx.date ? ` (ECB reference rates, ${fx.date})` : ""}, rounded, and leave out shipping, import duty, GST/VAT and card fees. A camera bought abroad may not carry a local warranty: see{" "}
        <Link href="/guides/grey-market-cameras">grey-market cameras</Link> before you buy.
      </p>
    </div>
    </section>
  );
}

/** A body-only price, else a kit marked as one, else a dash ("out of stock" when the market lists it). */
function Cell({ value, kit, currency, listed }: { value: number | null; kit: { price: number; label: string } | null; currency: Currency; listed: boolean }) {
  if (value !== null) return <span className="font-semibold">{price(value, currency)}</span>;
  if (kit)
    return (
      <span>
        <span className="font-semibold">{price(kit.price, currency)}</span> <span className="rounded bg-raised px-1 text-[10px] font-semibold uppercase tracking-wide text-muted">kit</span>
        <span className="block text-[11px] font-normal text-subtle">{kit.label}</span>
      </span>
    );
  return <span className="text-subtle" title={listed ? "Listed, but not in stock body-only" : undefined}>—</span>;
}
