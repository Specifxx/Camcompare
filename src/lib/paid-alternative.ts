// "or $X at eBay" under the hero's best price (2026-11-10, ported from RiftCompare's
// lib/paid-alternative.ts, owner 2026-10-27).
//
// The 30 days to 10 Nov: 197 buy clicks, 96 of them to a link that can earn, and A$0
// earned (/mnt/project-files/traffic/zero-earnings-diagnosis-2026-11-10.html). The hero
// names one store, the cheapest, which often pays nothing. The rule: when the hero's offer
// is not a paid link, name the cheapest paid offer of the SAME kind (new body-only, used
// body-only, or a kit of the same condition group: lib/price-rules.ts), in stock, within
// PAID_ALTERNATIVE_BAND of it. A real row of the table at its real price, labelled "Paid
// link"; never called cheaper, never "Best price", never a reorder. Pure: the caller says
// which offers pay (toRow's `paid`).
import { groupOf } from "./price-rules";
import type { Offer } from "./offers";

/** At most 20% above the hero's price. */
export const PAID_ALTERNATIVE_BAND = 1.2;

export function paidAlternative(lead: { offer: Offer; what: "new" | "used" | "kit" }, offers: Offer[], pays: (o: Offer) => boolean): { offer: Offer; pctMore: number } | null {
  const best = lead.offer;
  if (pays(best) || !(best.price > 0)) return null;
  const same = (o: Offer) => o !== best && o.inStock && o.currency === best.currency && (lead.what === "kit" ? o.kit && groupOf(o) === groupOf(best) : !o.kit && groupOf(o) === lead.what);
  let pick: Offer | null = null;
  for (const o of offers) if (same(o) && o.price > 0 && o.price <= best.price * PAID_ALTERNATIVE_BAND && (!pick || o.price < pick.price) && pays(o)) pick = o;
  return pick ? { offer: pick, pctMore: Math.max(0, Math.round(((pick.price - best.price) / best.price) * 100)) } : null;
}
