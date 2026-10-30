import { offersGeneratedAt } from "@/lib/catalog";
import { listPrice, price } from "@/lib/format";
import { dealSignal, usedSaving, vsLaunch } from "@/lib/insights";
import { MARKETS, type Currency, type MarketCode } from "@/lib/markets";
import { toRow, type PackKind } from "@/lib/offer-rows";
import { AMAZON_MAX_AGE_H, isAmazonOffer, type HistoryPoint, type Offer } from "@/lib/offers";
import { headline, kitText, leadOffer, lowestKit, typicalRange } from "@/lib/price-rules";
import { retailer } from "@/lib/retailers";
import { usedValue } from "@/lib/value";
import OutboundLink from "./OutboundLink";
import { retailerButtonClass } from "./OfferRows";
import TimedPrice from "./TimedPrice";

/** Amazon's price only with its time, and only while under a day old. */
const shown = (o: Offer, cur: Currency) => (isAmazonOffer(o) ? <TimedPrice text={price(o.price, cur)} seenAt={o.seenAt} maxAgeH={AMAZON_MAX_AGE_H} /> : price(o.price, cur));
const storeName = (o: Offer) => retailer(o.retailer)?.name ?? o.retailer;

/**
 * The hero's price panel, like a shopping panel's: "Typically X–Y", the best
 * price with its tag, one clear "Best price at <store>" button, then used,
 * RRP and how today compares. The rules are lib/price-rules.ts, the same as
 * the table's "Best price" row, cards, quick view, world panel, metadata and
 * JSON-LD: in-stock body-only new first, else used, else a kit labelled as
 * one. Amazon's price counts here only because it is shown live, with its
 * time.
 *
 * The button is filled even when its link doesn't earn (an exception to
 * "filled only when paid"): it is always the cheapest offer, chosen by price,
 * and "Paid link" still says when it earns.
 */
export default function PriceBox({ offers, history, launch, market, pack, page, extra }: { offers: Offer[]; history: HistoryPoint[]; launch: { amount: number; currency: Currency } | null; market: MarketCode; pack: PackKind; page: string; extra?: string }) {
  const cur = MARKETS[market].currency;
  const h = headline(offers, true);
  const lead = leadOffer(h);
  const today = offersGeneratedAt(market)?.slice(0, 10) ?? null;
  // Today's history point is the import day's: deals compare with the days before it.
  const deal = dealSignal(history, h.new?.price ?? null, "new", today);
  const saving = usedSaving(h.new?.price ?? null, h.used?.price ?? null);
  const launchDelta = launch && launch.currency === cur ? vsLaunch(h.new?.price ?? null, launch.amount) : null;
  const typical = typicalRange(offers, history, 90, today);
  const used = usedValue(history);
  const mkt = MARKETS[market].name;

  const facts = (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
      {h.used && lead?.what !== "used" && (
        <div>
          <dt className="text-xs text-subtle">Used from</dt>
          <dd>
            <span className="price font-semibold">{shown(h.used, cur)}</span> <span className="text-xs text-subtle">at {storeName(h.used)}</span>
            {saving !== null && <span className="block text-xs text-win">{saving}% under new</span>}
          </dd>
        </div>
      )}
      {used && (
        <div>
          <dt className="text-xs text-subtle">Used, typically</dt>
          <dd className="price font-semibold">{price(used.value, cur)}</dd>
        </div>
      )}
      {launch && (
        <div>
          <dt className="text-xs text-subtle">Launch RRP{extra ?? ""}</dt>
          <dd>
            <span className="price font-semibold">{listPrice(launch.amount, launch.currency)}</span>
            {launchDelta !== null && <span className={`block text-xs ${launchDelta > 0 ? "text-warn" : "text-win"}`}>Best new is {launchDelta <= 0 ? `${-launchDelta}% under` : `${launchDelta}% over`}</span>}
          </dd>
        </div>
      )}
    </dl>
  );

  if (!lead) {
    return (
      <div className="card flex flex-col gap-3 p-4 sm:p-5">
        <p className="text-sm text-muted">
          {h.listed ? `Listed in ${mkt}, but out of stock at every store we track today.` : `No live price in ${mkt} yet.`} We show a price only when a retailer&apos;s feed or API sends it: <a href="#prices">where to look</a>.
        </p>
        {facts}
      </div>
    );
  }

  const o = lead.offer;
  const row = toRow(o, { page, placement: "hero", pack });
  const tag = lead.what === "new" ? "Best price" : lead.what === "used" ? "Best used price" : "Best kit price";
  const what = lead.what === "new" ? `New${pack === "body" ? " · body only" : ""}` : lead.what === "used" ? `${row.condition}${pack === "body" ? " · body only" : ""}` : `${row.condition} · ${kitText(o, pack)}`;
  // With kits only: the cheapest used kit too, when the lead is a new one.
  const usedKit = lead.what === "kit" && o.condition === "new" ? lowestKit(offers, "used", true) : null;
  return (
    <div className="card flex flex-col gap-3 p-4 sm:p-5">
      {typical && lead.what === "new" && (
        <p className="text-sm">
          <span className="text-muted">Typically </span>
          <span className="price font-semibold">
            {price(typical.low, cur)}
            {typical.high > typical.low ? `–${price(typical.high, cur)}` : ""}
          </span>
          <span className="text-xs text-subtle"> new, from today&apos;s stores and the last 90 days</span>
        </p>
      )}
      {lead.what !== "new" && <p className="text-sm text-muted">{lead.what === "kit" ? `No body-only price in ${mkt} today. The cheapest kit:` : `No new body-only price in ${mkt} today. The cheapest used:`}</p>}
      <div>
        <p className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-buy px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-buy-fg">{tag}</span>
          <span className="text-xs text-muted">{what} · in stock</span>
        </p>
        <p className={`price mt-1 font-display text-4xl font-extrabold tracking-[-0.03em] ${lead.what === "new" ? "text-buy" : ""}`}>{shown(o, cur)}</p>
        <p className="text-sm text-muted">
          at <span className="font-semibold text-fg">{storeName(o)}</span>
          {deal && <span className={`ml-2 chip ${deal.kind === "above-avg" ? "text-warn" : "text-win"}`}>{deal.text}</span>}
        </p>
      </div>
      <div>
        <OutboundLink href={row.href} retailer={o.retailer} product={o.product} placement="hero" className={`${row.paid ? retailerButtonClass(o.retailer, true) : "btn-primary"} w-full py-2.5 text-base sm:w-auto sm:px-6`}>
          {tag} at {storeName(o)} <span aria-hidden>→</span>
        </OutboundLink>
        {row.paid && <p className="mt-1 text-[11px] text-subtle">Paid link: we may earn a commission. It never changes which price is best.</p>}
      </div>
      <div className="border-t border-line pt-3">
        {usedKit && (
          <p className="mb-2 text-sm">
            <span className="text-xs text-subtle">Used kit from </span>
            <span className="price font-semibold">{shown(usedKit, cur)}</span> <span className="text-xs text-subtle">at {storeName(usedKit)} · {kitText(usedKit, pack)}</span>
          </p>
        )}
        {facts}
      </div>
    </div>
  );
}
