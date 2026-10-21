// Can it be ordered, and where? One answer for the "Where to preorder/buy"
// box on /releases, the restock and preorder alerts (scripts/check-alerts.ts)
// and the watch check (scripts/check-watched.ts), so a card and an email never
// disagree. Pure and client-safe.
//
// Only stores count: never a marketplace seller (eBay listings, a seller on
// a store's marketplace) and never Amazon, whose price may not be stored.
// The owner's friend paid a reseller for a flash no Australian store had yet;
// "a store has it" is the whole promise.
import type { Offer } from "../offers";
import { retailer } from "../retailers";

/** Best first. */
export const ORDER_STATES = ["in_stock", "preorder", "backorder", "out", "none"] as const;
export type OrderState = (typeof ORDER_STATES)[number];

export const ORDER_STATE_LABEL: Record<OrderState, string> = { in_stock: "In stock", preorder: "Preorder", backorder: "Backorder", out: "Sold out", none: "Not listed yet" };

/** One offer's state: the source's availability when it says, else in or out of stock. */
export function offerState(o: Pick<Offer, "inStock" | "availability">): Exclude<OrderState, "none"> {
  switch (o.availability) {
    case "preorder":
      return "preorder";
    case "backorder":
      return "backorder";
    case "out_of_stock":
      return "out";
    case "in_stock":
    case "low_stock":
      return "in_stock";
    default:
      return o.inStock ? "in_stock" : "out";
  }
}

/** A store's own listing: not Amazon, not eBay, not a marketplace seller. */
export const isStoreOffer = (o: Offer) => {
  const r = retailer(o.retailer);
  return !o.seller && !r?.amazon && !r?.ebay;
};

const rank = (s: OrderState) => ORDER_STATES.indexOf(s);

/** The best state among these offers, for one condition group ("new" for releases and preorders). */
export function orderState(offers: Offer[], condition: "new" | "used" | "any" = "new"): OrderState {
  let best: OrderState = "none";
  for (const o of offers) {
    if (!isStoreOffer(o)) continue;
    if (condition === "new" ? o.condition !== "new" : condition === "used" ? o.condition === "new" : false) continue;
    const s = offerState(o);
    if (rank(s) < rank(best)) best = s;
  }
  return best;
}

export const canOrder = (s: OrderState) => s === "in_stock" || s === "preorder";

export type StoreRow = { offer: Offer; state: Exclude<OrderState, "none"> };

/** Stores listing it new, the orderable ones first, then by price. One row per store (its best listing). */
export function storeRows(offers: Offer[], max = 6): StoreRow[] {
  const best = new Map<string, StoreRow>();
  for (const o of offers) {
    if (!isStoreOffer(o) || o.condition !== "new") continue;
    const row = { offer: o, state: offerState(o) };
    const cur = best.get(o.retailer);
    if (!cur || rank(row.state) < rank(cur.state) || (rank(row.state) === rank(cur.state) && (Number(o.kit) - Number(cur.offer.kit) || o.price - cur.offer.price) < 0)) best.set(o.retailer, row);
  }
  return [...best.values()].sort((a, b) => rank(a.state) - rank(b.state) || Number(a.offer.kit) - Number(b.offer.kit) || a.offer.price - b.offer.price).slice(0, max);
}
