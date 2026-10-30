// Tagged eBay searches for the places that send buyers to eBay without a
// live listing: the product page's "On eBay" card (used, new, recently
// sold), the used filter, the quick view, accessories, deals, digicams,
// viral cameras, My gear, the home page strip and EbayPromo. eBay's Browse
// API keys aren't set, so these are searches, never prices; every one goes
// through affiliateUrl (the owner's EPN campaign, the site's rotation id and
// a customid naming the placement) and shows "Paid link". Singapore has no
// EPN programme: every builder returns null there, and callers show nothing.
// Server-only: links are wrapped with this build's affiliate ids.
import { affiliateUrl, isPaid, subId } from "./affiliate";
import type { MarketCode } from "./markets";
import { ebayFor } from "./retailers";
import { EBAY_QUERY_SLOT, type EbayTemplate } from "./ebay-template";
import type { EbaySearchLink } from "./quickview";

/** eBay's Cameras & Photo category, the same id on every eBay site we link to. */
export const EBAY_CAMERAS_PHOTO = 625;

// eBay US category ids (eBay's Cameras & Photo category list,
// pages.ebay.com/sellerinformation/growing/categorychanges/cameras.html,
// read 2026-10-23). The other sites' trees number some leaves differently,
// so outside the US a search narrows to Cameras & Photo (625) only.
export const EBAY_US_CATEGORY = {
  digitalCameras: 31388,
  lenses: 3323,
  filmCameras: 15230,
  drones: 179697,
  accessories: 15200, // Camera & Photo Accessories
} as const;

/**
 * Accessory sections → eBay US category. `null`: no category at all, on any
 * site (drives and audio recorders sit outside Cameras & Photo). Unlisted:
 * Cameras & Photo (625).
 */
const ACCESSORY_US: Record<string, number | null> = {
  tripods: 30090, // Tripods & Supports
  monopods: 30090,
  plates: 30090,
  drones: 179697, // Camera Drones
  batteries: 162045, // Batteries
  chargers: 162046, // Chargers & Cradles
  grips: 29967, // Battery Grips
  straps: 64343, // Straps & Hand Grips
  filters: 15216, // Filters
  flashes: 64353, // Flashes & Flash Accessories
  triggers: 64353,
  strobes: 30078, // Lighting & Studio
  "led-lights": 30078,
  modifiers: 30078,
  backdrops: 30078,
  bags: 107894, // Cases, Bags & Covers
  cleaning: 162053, // Cleaning Equipment & Kits
  adapters: 30059, // Lens Adapters, Mounts & Tubes
  "memory-cards": 18871, // Memory Cards
  film: 4201, // Film
  cables: 155707, // Cables & Adapters
  "tether-cables": 155707,
  microphones: 83857, // Microphones
  "shotgun-mics": 83857,
  "wireless-mics": 83857,
  remotes: 64345, // Remotes & Shutter Releases
  monitors: 21162, // Video Production & Editing
  recorders: 21162,
  "video-transmitters": 21162,
  "video-switchers": 21162,
  "matte-boxes": 21162,
  storage: null,
  "audio-recorders": null,
};

/** The eBay category for an accessory section in this market, or null for none. */
export function accessoryEbayCategory(category: string, m: MarketCode): number | null {
  const us = ACCESSORY_US[category];
  if (us === null) return null;
  return m === "us" && us !== undefined ? us : EBAY_CAMERAS_PHOTO;
}

export type EbaySearch = {
  query: string;
  /** eBay's condition filter: LH_ItemCondition=3000 used, 1000 new. */
  condition?: "used" | "new";
  /** Sold listings only (LH_Sold=1&LH_Complete=1): what things actually went for. */
  sold?: boolean;
  /** eBay category id (_sacat); null for all categories. Default Cameras & Photo. */
  category?: number | null;
};

export type EbayLink = EbaySearchLink;

/** The untagged eBay search URL in this market, or null where there is no eBay programme. */
export function ebaySearchUrl(m: MarketCode, s: EbaySearch): string | null {
  const r = ebayFor(m);
  if (!r) return null;
  const u = new URL("/sch/i.html", r.site);
  u.searchParams.set("_nkw", s.query.replace(/α/g, "a").trim());
  const cat = s.category === undefined ? EBAY_CAMERAS_PHOTO : s.category;
  if (cat !== null) u.searchParams.set("_sacat", String(cat));
  if (s.condition) u.searchParams.set("LH_ItemCondition", s.condition === "used" ? "3000" : "1000");
  if (s.sold) {
    u.searchParams.set("LH_Sold", "1");
    u.searchParams.set("LH_Complete", "1");
  }
  return u.toString();
}

/** One tagged eBay search link, its customid "cc-<page>-<placement>". */
export function ebayLink(m: MarketCode, s: EbaySearch, page: string, placement: string, label: string): EbayLink | null {
  const r = ebayFor(m);
  const raw = ebaySearchUrl(m, s);
  if (!r || !raw) return null;
  const href = affiliateUrl(r.key, raw, subId(page, placement));
  return { retailer: r.key, name: r.name, href, paid: isPaid(r.key, href), label };
}

/** A tagged search with the words left as a slot for the browser to fill (lib/ebay-template.ts). */
export function ebayTemplate(m: MarketCode, s: Omit<EbaySearch, "query">, page: string, placement: string): EbayTemplate | null {
  const l = ebayLink(m, { ...s, query: EBAY_QUERY_SLOT }, page, placement, "");
  return l && { href: l.href, paid: l.paid, retailer: l.retailer, name: l.name };
}

/**
 * The eBay category a product's searches narrow to: Cameras & Photo (the
 * default, `undefined`) for every camera, drone and lens; none for camera
 * glasses, which eBay files under wearables, outside Cameras & Photo.
 */
export const productEbayCategory = (type: string | null | undefined): null | undefined => (type === "smart-glasses" ? null : undefined);

export type ProductEbayLinks = { name: string; used: EbayLink; new: EbayLink; sold: EbayLink };

/**
 * A camera's or lens's three eBay searches: used, new and recently sold, in
 * Cameras & Photo. `prefix` names the placement family: "product" on the
 * product page (product-ebay-used…), "qv" in the quick view.
 */
export function productEbayLinks(query: string, name: string, m: MarketCode, page: string, prefix: string, category?: number | null): ProductEbayLinks | null {
  const used = ebayLink(m, { query, condition: "used", category }, page, `${prefix}-ebay-used`, `Search used ${name} on eBay`);
  const fresh = ebayLink(m, { query, condition: "new", category }, page, `${prefix}-ebay-new`, `Search new ${name} on eBay`);
  const sold = ebayLink(m, { query, sold: true, category }, page, `${prefix}-ebay-sold`, "Recently sold on eBay");
  if (!used || !fresh || !sold) return null;
  return { name: used.name, used, new: fresh, sold };
}

/** The home page strip and EbayPromo's default: used cameras by kind, each tagged. */
export function ebayCategoryLinks(m: MarketCode, page: string, placement: string): EbayLink[] {
  const us = m === "us";
  const cat = (id: number) => (us ? id : EBAY_CAMERAS_PHOTO);
  const out = [
    ebayLink(m, { query: "mirrorless camera", condition: "used", category: cat(EBAY_US_CATEGORY.digitalCameras) }, page, placement, "Used mirrorless cameras"),
    ebayLink(m, { query: "lens", condition: "used", category: cat(EBAY_US_CATEGORY.lenses) }, page, placement, "Used lenses"),
    ebayLink(m, { query: "film camera", category: cat(EBAY_US_CATEGORY.filmCameras) }, page, placement, "Film cameras"),
    ebayLink(m, { query: "drone", condition: "used", category: cat(EBAY_US_CATEGORY.drones) }, page, placement, "Used drones"),
  ];
  return out.filter((l): l is EbayLink => l !== null);
}

/** A product page's EbayPromo: used gear from the same maker and for the same mount. */
export function ebayRelatedLinks(m: MarketCode, page: string, placement: string, x: { brand: string; mountName: string | null; kind: "camera" | "lens" }): EbayLink[] {
  const us = m === "us";
  const cams = us ? EBAY_US_CATEGORY.digitalCameras : EBAY_CAMERAS_PHOTO;
  const lenses = us ? EBAY_US_CATEGORY.lenses : EBAY_CAMERAS_PHOTO;
  // "Sony E-mount" → "Sony E", "Canon EF / EF-S" → "Canon EF"; "L-Mount" stays.
  const mount = x.mountName?.replace(/\s*\/.*$/, "").replace(/(\s\S+)[\s-]mount$/i, "$1") ?? null;
  const out = [
    ebayLink(m, { query: `${x.brand} camera`, condition: "used", category: cams }, page, placement, `Used ${x.brand} cameras`),
    ebayLink(m, { query: `${x.brand} lens`, condition: "used", category: lenses }, page, placement, `Used ${x.brand} lenses`),
    mount ? ebayLink(m, { query: `${mount} lens`, condition: "used", category: lenses }, page, placement, `Used ${mount} lenses`) : null,
    ebayLink(m, { query: `${x.brand} camera`, sold: true, category: cams }, page, placement, `${x.brand} cameras: recently sold`),
  ];
  // A lens page leads with lenses.
  if (x.kind === "lens") out.unshift(...out.splice(1, 2));
  const seen = new Set<string>();
  return out.filter((l): l is EbayLink => l !== null && !seen.has(l.label) && Boolean(seen.add(l.label)));
}
