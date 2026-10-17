import { listPrice, price } from "@/lib/format";
import { dealSignal, usedSaving, vsLaunch } from "@/lib/insights";
import { MARKETS, type Currency, type MarketCode } from "@/lib/markets";
import type { HistoryPoint, Offer } from "@/lib/offers";
import { retailer } from "@/lib/retailers";

export default function PriceBox({ newOffer, usedOffer, history, launch, market, extra }: { newOffer: Offer | null; usedOffer: Offer | null; history: HistoryPoint[]; launch: { amount: number; currency: Currency } | null; market: MarketCode; extra?: string }) {
  const cur = MARKETS[market].currency;
  const deal = dealSignal(history, newOffer?.price ?? null);
  const saving = usedSaving(newOffer?.price ?? null, usedOffer?.price ?? null);
  const launchDelta = launch && launch.currency === cur ? vsLaunch(newOffer?.price ?? null, launch.amount) : null;
  if (!newOffer && !usedOffer) {
    return (
      <div className="flex flex-col gap-1 text-sm">
        <p className="text-muted">
          Not priced in {MARKETS[market].name} yet: <a href="#prices">check it at the retailers below</a>.
        </p>
        {launch && <p className="text-xs text-subtle">Launch price {listPrice(launch.amount, launch.currency)}{extra ?? ""}.</p>}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="card p-3">
          <p className="text-xs text-subtle">Lowest new</p>
          <p className="price text-xl font-bold text-buy">{newOffer ? price(newOffer.price, cur) : "—"}</p>
          {newOffer && <p className="text-xs text-subtle">at {retailer(newOffer.retailer)?.name ?? newOffer.retailer}</p>}
        </div>
        <div className="card p-3">
          <p className="text-xs text-subtle">Lowest used/refurb</p>
          <p className="price text-xl font-bold">{usedOffer ? price(usedOffer.price, cur) : "—"}</p>
          {usedOffer && <p className="text-xs text-subtle">at {retailer(usedOffer.retailer)?.name ?? usedOffer.retailer}</p>}
          {saving !== null && <p className="text-xs text-win">{saving}% under new</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {deal && <span className={`chip ${deal.kind === "above-avg" ? "text-warn" : "text-win"}`}>{deal.text}</span>}
        {launch && (
          <span className="text-subtle">
            Launch price {listPrice(launch.amount, launch.currency)}{extra ?? ""}
            {launchDelta !== null ? ` · today ${launchDelta <= 0 ? `${-launchDelta}% under` : `${launchDelta}% over`}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
