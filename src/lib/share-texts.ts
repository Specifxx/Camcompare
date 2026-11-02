// The share message for a product in one market (build time: it reads the catalog). lib/share-link.ts has the rest.
// The gap is between the cheapest and dearest NEW, in-stock, body-only price from two stores; Amazon's price never
// (its licence keeps it out of everything but the live row), and a kit is not the body's price.
import { isAmazonOffer, type Offer } from "./offers";
import { retailer } from "./retailers";
import { price } from "./format";
import { SITE_NAME } from "./site";
import { priceGap } from "./share-link";

export function productShareText(name: string, offers: readonly Offer[]): string {
  const rows = offers
    .filter((o) => o.inStock && !o.kit && o.condition === "new" && !isAmazonOffer(o))
    .map((o) => ({ price: o.price, store: retailer(o.retailer)?.name ?? o.retailer, currency: o.currency }));
  const gap = priceGap(rows);
  if (!gap) return `${name}: every store's price on ${SITE_NAME}`;
  const cur = (rows.find((r) => r.store === gap.low.store) ?? rows[0]).currency;
  return `${name}: ${price(gap.low.price, cur)} new at ${gap.low.store}, up to ${price(gap.high.price, cur)} elsewhere (${gap.pct}% less). Compared on ${SITE_NAME}`;
}
