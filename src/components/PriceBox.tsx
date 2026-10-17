import { offersGeneratedAt } from "@/lib/catalog";
import { listPrice, price } from "@/lib/format";
import { dealSignal, usedSaving, vsLaunch } from "@/lib/insights";
import { MARKETS, type Currency, type MarketCode } from "@/lib/markets";
import { AMAZON_MAX_AGE_H, isAmazonOffer, type HistoryPoint, type Offer } from "@/lib/offers";
import { retailer } from "@/lib/retailers";
import { usedValue } from "@/lib/value";
import TimedPrice from "./TimedPrice";

/** Amazon's price only with its time, and only while under a day old. */
const shown = (o: Offer, cur: Currency) => (isAmazonOffer(o) ? <TimedPrice text={price(o.price, cur)} seenAt={o.seenAt} maxAgeH={AMAZON_MAX_AGE_H} /> : price(o.price, cur));

export default function PriceBox({ newOffer, usedOffer, history, launch, market, extra }: { newOffer: Offer | null; usedOffer: Offer | null; history: HistoryPoint[]; launch: { amount: number; currency: Currency } | null; market: MarketCode; extra?: string }) {
  const cur = MARKETS[market].currency;
  // Today's history point is the import day's: deals compare with the days before it.
  const deal = dealSignal(history, newOffer?.price ?? null, "new", offersGeneratedAt(market)?.slice(0, 10));
  const saving = usedSaving(newOffer?.price ?? null, usedOffer?.price ?? null);
  const launchDelta = launch && launch.currency === cur ? vsLaunch(newOffer?.price ?? null, launch.amount) : null;
  const typical = usedValue(history);
  // RRP and the second-hand price, side by side near the top (friends' feedback, 2026-10-17).
  const rrpLine = (launch || typical || usedOffer) && (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {launch && (
        <span>
          <span className="text-subtle">Launch RRP </span>
          <span className="price font-semibold">{listPrice(launch.amount, launch.currency)}</span>
          <span className="text-subtle">{extra ?? ""}</span>
        </span>
      )}
      {typical ? (
        <span>
          <span className="text-subtle">Used, typically </span>
          <span className="price font-semibold">{price(typical.value, cur)}</span>
        </span>
      ) : usedOffer ? (
        <span>
          <span className="text-subtle">Used from </span>
          <span className="price font-semibold">{shown(usedOffer, cur)}</span>
        </span>
      ) : null}
    </p>
  );
  if (!newOffer && !usedOffer) {
    return (
      <div className="flex flex-col gap-1 text-sm">
        <p className="text-muted">
          No live price in {MARKETS[market].name} yet. We show one only when a retailer&apos;s feed or API sends it: <a href="#prices">where to look</a>.
        </p>
        {rrpLine}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {rrpLine}
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="card p-3">
          <p className="text-xs text-subtle">Lowest new</p>
          <p className="price text-xl font-bold text-buy">{newOffer ? shown(newOffer, cur) : "—"}</p>
          {newOffer && <p className="text-xs text-subtle">at {retailer(newOffer.retailer)?.name ?? newOffer.retailer}</p>}
        </div>
        <div className="card p-3">
          <p className="text-xs text-subtle">Lowest used/refurb</p>
          <p className="price text-xl font-bold">{usedOffer ? shown(usedOffer, cur) : "—"}</p>
          {usedOffer && <p className="text-xs text-subtle">at {retailer(usedOffer.retailer)?.name ?? usedOffer.retailer}</p>}
          {saving !== null && <p className="text-xs text-win">{saving}% under new</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {deal && <span className={`chip ${deal.kind === "above-avg" ? "text-warn" : "text-win"}`}>{deal.text}</span>}
        {launchDelta !== null && <span className={launchDelta > 0 ? "text-warn" : "text-subtle"}>Lowest new today is {launchDelta <= 0 ? `${-launchDelta}% under` : `${launchDelta}% over`} launch RRP</span>}
      </div>
    </div>
  );
}
