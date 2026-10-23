import { historyFor, launchPrice, product as getProduct } from "@/lib/catalog";
import { MARKETS, type MarketCode } from "@/lib/markets";
import { AMAZON_MAX_AGE_H, type Offer } from "@/lib/offers";
import { alsoCheckLinks, ebayRows, offerRows, packKind } from "@/lib/offer-rows";
import { price } from "@/lib/format";
import type { OfferRow } from "@/lib/quickview";
import { usedValue } from "@/lib/value";
import EbayPanel from "./EbayPanel";
import EbayText from "./ebay/EbayText";
import { ebayLink } from "@/lib/ebay-links";
import { ebayFor } from "@/lib/retailers";
import { OFFER_TABS, rowInTab, tabHideClass, type OfferTab } from "@/lib/offer-tabs";
import OfferTabs from "./MoreOffers";
import { AlsoCheck, OfferRowItem } from "./OfferRows";
import TimedPrice from "./TimedPrice";

/**
 * Where to buy, in one market, like a shopping panel: filters for New, Used &
 * second-hand, Refurbished and Kits over one list. Rows hold real prices only:
 * every priced offer except eBay's, identical listings merged ("×2 listings"),
 * body-only first (in stock cheapest first, then out of stock), then kits,
 * each labelled with its lens and never counted as the body price. Never
 * ordered by commission. eBay sits beside them (EbayPanel: live listings
 * when there are some, and tagged used, new and sold searches), and the
 * Used filter ends with a tagged "More used … on eBay" search;
 * stores we may not price yet are tagged links in "Also check", never rows.
 *
 * Payload: each row is rendered once and the filters only hide rows (CSS on
 * the wrapper's data-tab), so the HTML carries the first few rows of every
 * filter and no more. The rest come from the product's static quick-view
 * file (public/offers/<market>/<slug>.json) when asked (MoreOffers.tsx).
 */
const FIRST_BODY = 5;
const FIRST_KITS = 3;

export default function OffersTable({ product, query, offers, market, page, amazonAsin }: { product: string; query: string; offers: Offer[]; market: MarketCode; page: string; amazonAsin?: string }) {
  const p = getProduct(product);
  const pack = p ? packKind(p) : "lens";
  const rows = offerRows(offers, { page, placement: "offers", pack, withAmazon: true });
  const listings = ebayRows(offers, market, { page, placement: "ebay", pack });
  // eBay has its own card (EbayPanel) with used, new and sold searches, so it is not in "Also check".
  const checks = alsoCheckLinks({ product, query, offers, market, page, amazonAsin, placement: "check", amazonShown: rows.some((r) => r.amazon), ebay: false });
  const ebayUsed = ebayLink(market, { query, condition: "used" }, page, "product-ebay-tab-used", `More used ${query} on eBay`);
  const side = listings.length > 0 || checks.length > 0 || Boolean(ebayFor(market));
  // Warnings on rows above this market's RRP or the typical used price (OfferRows).
  const launch = p ? launchPrice(p.item, market) : null;
  const rrp = launch && launch.currency === MARKETS[market].currency ? Math.round(launch.amount * 100) : null;
  const usedTypical = usedValue(historyFor(product, market))?.value ?? null;

  // Which rows the HTML carries: the first few body-only rows and kits of
  // every filter, plus Amazon's (never in the public file).
  const shown = new Set<string>();
  for (const t of OFFER_TABS) {
    const inTab = rows.filter((r) => rowInTab(r, t.key));
    for (const r of inTab.filter((r) => !r.kit).slice(0, FIRST_BODY)) shown.add(r.id);
    for (const r of inTab.filter((r) => r.kit).slice(0, FIRST_KITS)) shown.add(r.id);
  }
  for (const r of rows) if (r.amazon) shown.add(r.id);
  const tabs = OFFER_TABS.map((t) => {
    const inTab = rows.filter((r) => rowInTab(r, t.key));
    return { key: t.key, label: t.label, count: inTab.length, more: inTab.filter((r) => !shown.has(r.id)).length, body: inTab.filter((r) => !r.kit).length, kits: inTab.filter((r) => r.kit).length };
  }).filter((t) => t.key === "all" || t.count > 0);
  // Open on what a buyer came for: new body prices, else used, else kits.
  const has = (k: OfferTab) => rows.some((r) => rowInTab(r, k) && !r.kit && r.inStock);
  const initial: OfferTab = has("new") ? "new" : has("used") ? "used" : has("refurb") ? "refurb" : rows.some((r) => r.kit) ? "kit" : "all";
  // A group's heading hides in the filters where the group is empty.
  const noBody = tabHideClass(tabs.filter((t) => t.body === 0).map((t) => t.key));
  const noKits = tabHideClass(tabs.filter((t) => t.kits === 0).map((t) => t.key));

  const item = (r: OfferRow) => (
    <OfferRowItem
      key={r.id}
      row={r}
      product={product}
      placement="offers"
      rrp={rrp}
      usedTypical={usedTypical}
      className={tabHideClass(OFFER_TABS.filter((t) => !rowInTab(r, t.key)).map((t) => t.key))}
      priceNode={r.amazon && r.seenAt ? <TimedPrice text={price(r.price, r.currency)} seenAt={r.seenAt} maxAgeH={AMAZON_MAX_AGE_H} /> : undefined}
    />
  );
  const body = rows.filter((r) => !r.kit && shown.has(r.id));
  const kits = rows.filter((r) => r.kit && shown.has(r.id));
  const kitWord = pack === "body" ? "Kits: the body with a lens" : "Kits and bundles";
  return (
    <div className={`grid grid-cols-1 items-start gap-4 ${side ? "lg:grid-cols-[minmax(0,1fr)_300px]" : ""}`}>
      <div className="min-w-0">
        {rows.length ? (
          <OfferTabs
            tabs={tabs}
            initial={initial}
            slug={product}
            market={market}
            shown={[...shown]}
            rrp={rrp}
            usedTypical={usedTypical}
            kitWord={kitWord}
            footer={
              ebayUsed && (
                <p className={`text-sm ${tabHideClass(OFFER_TABS.filter((t) => t.key !== "used").map((t) => t.key))}`}>
                  <EbayText link={ebayUsed} product={product} placement="product-ebay-tab-used">{ebayUsed.label}</EbayText>
                  <span className="block text-xs text-subtle">Single sellers, auctions included: check the listing&apos;s condition and returns.</span>
                </p>
              )
            }
            body={body.length > 0 && <ul className={`card divide-y divide-line overflow-hidden ${noBody}`}>{body.map(item)}</ul>}
            kits={
              kits.length > 0 && (
                <div className={noKits}>
                  <h3 className="mb-1.5 text-sm font-bold text-muted">{kitWord}</h3>
                  <ul className="card divide-y divide-line overflow-hidden">{kits.map(item)}</ul>
                </div>
              )
            }
          />
        ) : (
          <div className="card p-5">
            <p className="font-semibold">No live prices in {MARKETS[market].name} yet</p>
            <p className="mt-1 text-sm text-muted">We list a price only when a retailer&apos;s own feed or API sends one, checked every day. None has for this product here yet.</p>
          </div>
        )}
        {rows.length > 0 && (
          <p className="mt-2 text-[11px] text-subtle">
            Sorted by price, body only first, cheapest in stock first. Kits are listed apart and never counted as the body price. Some links earn us a commission; it never changes the order.
          </p>
        )}
        {rows.some((r) => r.amazon) && (
          <p className="mt-1 text-[11px] text-subtle">
            Amazon prices and availability are accurate as of the time shown and are subject to change. The price and availability shown on Amazon at the time of purchase will apply.
          </p>
        )}
      </div>
      {side && (
        <div className="flex flex-col gap-4">
          <EbayPanel product={product} query={query} name={query} offers={offers} market={market} page={page} />
          <AlsoCheck links={checks} product={product} placement="check" />
        </div>
      )}
    </div>
  );
}
