import Link from "next/link";
import type { Camera } from "@/lib/catalog/schema";
import { brandName, displayName, displayShortName, launchPrice, lensesFor, offersFor } from "@/lib/catalog";
import { price } from "@/lib/format";
import { kitTotal, suggestKit } from "@/lib/kit";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import { lowest } from "@/lib/offers";

/** "Suggested kit": the body and two or three native lenses, picked by rule (lib/kit.ts), priced in the market's own currency. */
export default function SuggestedKit({ c, m }: { c: Camera; m: MarketCode }) {
  const cur = MARKETS[m].currency;
  const newPrice = (slug: string) => lowest(offersFor(slug, m), "new")?.price ?? null;
  const body = newPrice(c.slug);
  const launch = launchPrice(c, m);
  // The price band follows what the body costs here: new today, else used, else its launch price.
  const ref = body ?? lowest(offersFor(c.slug, m), "used")?.price ?? (launch ? Math.round(launch.amount * 100) : null);
  const picks = suggestKit(c, lensesFor(c), newPrice, ref, brandName(c.brand));
  if (!picks.length) return null;
  const { total, missing } = kitTotal(body, picks);
  const cell = "border-t border-line px-3 py-2 align-top";
  return (
    <section>
      <h2 className="h-section mb-1">Suggested kit</h2>
      <p className="mb-3 text-sm text-muted">The body and lenses that fit it natively, picked by focal range and price from our catalog. Lowest new price today in {MARKETS[m].name}.</p>
      <div className="overflow-x-auto rounded border border-line">
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="px-3 py-2 align-top">
                <span className="font-semibold">{displayName(c, m)}</span>
                <span className="block text-xs text-muted">The body.</span>
              </td>
              <td className="price whitespace-nowrap px-3 py-2 text-right align-top">{body !== null ? price(body, cur) : "Not priced today"}</td>
            </tr>
            {picks.map((p) => (
              <tr key={p.lens.slug}>
                <td className={cell}>
                  <Link prefetch={false} href={marketPath(m, `/lenses/${p.lens.slug}`)} className="font-semibold">
                    {brandName(p.lens.brand)} {displayShortName(p.lens, m)}
                  </Link>
                  <span className="block text-xs text-muted">{p.reason}</span>
                </td>
                <td className={`${cell} price whitespace-nowrap text-right`}>{p.price !== null ? price(p.price, cur) : "Not priced today"}</td>
              </tr>
            ))}
            <tr>
              <td className={`${cell} font-semibold`}>{missing ? `Total of the ${picks.length + 1 - missing} priced items` : "Total"}</td>
              <td className={`${cell} price whitespace-nowrap text-right font-semibold`}>{total > 0 ? price(total, cur) : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
