// The filters over "Where to buy" (OffersTable, MoreOffers): which rows each
// shows, and the classes that hide a row under the others. A row is rendered
// once; the wrapper's data-tab (group/o) decides what shows, so a filter costs
// no extra HTML and works before the script loads. Client-safe.
import type { OfferRow } from "./quickview";

export type OfferTab = "all" | "new" | "used" | "refurb" | "kit";

export const OFFER_TABS: { key: OfferTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "used", label: "Used & second-hand" },
  { key: "refurb", label: "Refurbished" },
  { key: "kit", label: "Kits" },
];

/** New, Used and Refurbished show that condition's body-only rows and then its kits; Kits shows every kit. */
export function rowInTab(r: Pick<OfferRow, "kit" | "cond" | "condition">, t: OfferTab): boolean {
  if (t === "all") return true;
  if (t === "kit") return r.kit;
  const cond = r.cond ?? (r.condition === "New" ? "new" : r.condition === "Refurbished" ? "refurb" : "used");
  return cond === t;
}

// Spelt out in full so Tailwind sees each class.
const HIDE: Record<OfferTab, string> = {
  all: "group-data-[tab=all]/o:hidden",
  new: "group-data-[tab=new]/o:hidden",
  used: "group-data-[tab=used]/o:hidden",
  refurb: "group-data-[tab=refurb]/o:hidden",
  kit: "group-data-[tab=kit]/o:hidden",
};

export const tabHideClass = (tabs: OfferTab[]) => tabs.map((t) => HIDE[t]).join(" ");
