import Link from "next/link";
import { offersFor } from "@/lib/catalog";
import { price } from "@/lib/format";
import { readFx } from "@/lib/fx";
import { worldRows, worldVerdict } from "@/lib/insights";
import { MARKET_CODES, MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import type { Offer } from "@/lib/offers";

/**
 * "Price around the world": each market's lowest new and used price in its
 * own currency, and beside it an approximate conversion into this page's
 * currency, labelled as such. The ONE place a converted figure appears
 * (DECISIONS 2026-10-17, "Price around the world"); every other price on the
 * site stays in its own currency. Amazon, kits and out-of-stock never count.
 */
export default function WorldPrices({ slug, path, market: here, name }: { slug: string; path: string; market: MarketCode; name: string }) {
  const fx = readFx();
  const byMarket = Object.fromEntries(MARKET_CODES.map((m) => [m, offersFor(slug, m)])) as Record<MarketCode, Offer[]>;
  const rows = worldRows(byMarket, here, fx);
  if (!rows.some((r) => r.new !== null || r.used !== null)) return null;
  const verdict = worldVerdict(rows, here);
  const cur = MARKETS[here].currency;
  const approx = (v: number | null, same: boolean) => (v === null || same ? null : <span className="block text-[11px] text-subtle">≈ {price(Math.round(v / 100) * 100, cur)}</span>);
  return (
    <section id="world-prices">
    <h2 className="h-section mb-3">Price around the world</h2>
    <div className="card flex flex-col gap-3 p-4">
      {verdict && <p className="font-semibold">{verdict.text}</p>}
      <p className="text-xs text-muted">Prices are in each market&apos;s own currency. Under each: ≈ in {cur} at today&apos;s exchange rate.</p>
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
                    {r.new !== null ? <span className="font-semibold">{price(r.new, r.currency)}</span> : <span className="text-subtle">—</span>}
                    {approx(r.newHere, same)}
                  </td>
                  <td className="price py-2 align-top">
                    {r.used !== null ? <span className="font-semibold">{price(r.used, r.currency)}</span> : <span className="text-subtle">—</span>}
                    {approx(r.usedHere, same)}
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
        <Link prefetch={false} href="/guides/grey-market-cameras">grey-market cameras</Link> before you buy.
      </p>
    </div>
    </section>
  );
}
