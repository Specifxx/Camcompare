// Decides which catalog camera a retailer listing is, or that it is none.
//
// Order of evidence: GTIN (exact), then maker part number, then the title.
// Title matching is where camera listings go wrong, so it is strict:
//  - the brand (or a sub-brand like Lumix, Pentax, Olympus) must be named;
//  - accessories, parts and "for Sony a7 IV" listings are refused outright;
//  - an alias only counts as a run of whole title words, so it can never be
//    the front of another model ("Z6 II" in "Z6 III", "R5" in "R50", "Z 50"
//    in "Z 50mm");
//  - the longest match wins ("a7C" vs "a7C II"), and two different cameras
//    left standing means the listing is refused rather than guessed.
// A wrong match puts a wrong price on a page, so every rule here is one-way:
// it can only refuse a listing, never invent one.
import type { Camera } from "./catalog/schema";
import type { Condition } from "./retailers";

const ROMAN: Record<string, string> = { "1": "i", "2": "ii", "3": "iii", "4": "iv", "5": "v", "6": "vi" };

/** Lowercase, "Mark II"/"Mk2"/"MkII" → "ii", α → a, split on anything but a-z0-9. */
export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/α/g, "a")
    .replace(/\b(?:mark|mk)\.?\s*([1-6]|i{1,3}|iv|vi?)\b/g, (_, n: string) => ` ${ROMAN[n] ?? n}`)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export const compact = (s: string) => tokens(s).join("");

const BRAND_WORDS: Record<string, string[]> = {
  sony: ["sony"],
  canon: ["canon"],
  nikon: ["nikon"],
  fujifilm: ["fujifilm", "fuji"],
  panasonic: ["panasonic", "lumix"],
  "om-system": ["om system", "omsystem", "om digital", "olympus"],
  leica: ["leica"],
  ricoh: ["ricoh", "pentax"],
  sigma: ["sigma"],
  hasselblad: ["hasselblad"],
};

// Listings that are not the camera itself. Checked on the lowercased title.
const NOT_A_CAMERA =
  /\b(battery|batteries|charger|grip|cage|strap|case|bag|protector|skin|decal|cover|eyecup|eye cup|cap|hood|filter|remote|cable|adapter|bracket|plate|hot ?shoe|microphone|gimbal|tripod|speedlite|flash unit|memory card|sd card|cfexpress card|manual|box only|empty box|dummy|replacement|repair|for parts|not working|broken|parts only|as[- ]is|shutter unit|mainboard|motherboard|lcd screen|sensor cleaning|rental|lens only|teleconverter|extension tube|viewfinder only|evf only)\b/;
// "for Sony a7 IV", "compatible with Canon R6": accessory phrasing.
const FOR_PHRASE = /\b(for|fits|compatible with)\s+(the\s+)?(sony|canon|nikon|fuji|fujifilm|panasonic|lumix|olympus|om system|leica|ricoh|pentax|sigma|hasselblad)\b/;
// A zoom or prime named next to an interchangeable-lens body means a kit.
const KIT = /\bkit\b|\bw\/\s*\d|\bwith\s+(an?\s+)?(\w+\s+)?\d{2,3}(-\d{2,3})?\s*mm|\+\s*(\w+\s+)?\d{2,3}(-\d{2,3})?\s*mm|\b\d{2,3}-\d{2,3}\s*mm\b|\blens(es)? (kit|bundle)\b/;
const BODY_ONLY = /\bbody( only)?\b/;

export type CatalogIndex = {
  byGtin: Map<string, Camera>;
  byModelCode: Map<string, Camera>;
  aliases: Map<string, Camera[]>; // compacted alias → cameras (one, unless the catalog has a clash)
};

const MAX_ALIAS_TOKENS = 6;

export function buildIndex(cameras: Camera[]): CatalogIndex {
  const byGtin = new Map<string, Camera>();
  const byModelCode = new Map<string, Camera>();
  const aliases = new Map<string, Camera[]>();
  for (const c of cameras) {
    for (const g of c.gtins) byGtin.set(normalizeGtin(g), c);
    for (const m of c.modelCodes) byModelCode.set(compact(m), c);
    const keys = new Set([...c.aliases, ...c.modelCodes, c.shortName].map(compact).filter((k) => k.length >= 2));
    for (const key of keys) aliases.set(key, [...(aliases.get(key) ?? []), c]);
  }
  return { byGtin, byModelCode, aliases };
}

/** UPC-A (12) and EAN-13 with a leading 0 are the same product. */
export function normalizeGtin(g: string): string {
  const d = g.replace(/\D/g, "");
  return d.replace(/^0+/, "");
}

export type Listing = { title: string; gtin?: string | null; mpn?: string | null };
export type MatchResult =
  | { camera: Camera; via: "gtin" | "mpn" | "title"; kit: boolean }
  | { camera: null; reason: string };

export function matchListing(listing: Listing, index: CatalogIndex): MatchResult {
  const lower = listing.title.toLowerCase();
  if (NOT_A_CAMERA.test(lower)) return { camera: null, reason: "accessory/part" };
  if (FOR_PHRASE.test(lower)) return { camera: null, reason: "accessory phrasing" };

  const kitFor = (c: Camera) => c.mount !== null && KIT.test(lower) && !BODY_ONLY.test(lower);

  if (listing.gtin) {
    const c = index.byGtin.get(normalizeGtin(listing.gtin));
    if (c) return { camera: c, via: "gtin", kit: kitFor(c) };
  }
  if (listing.mpn) {
    // Dealers append a colour or region: "ILCE-7M4/B", "ILCE-7M4/B BODY".
    const c = index.byModelCode.get(compact(listing.mpn)) ?? index.byModelCode.get(compact(listing.mpn.split("/")[0]));
    if (c) return { camera: c, via: "mpn", kit: kitFor(c) };
  }

  // An alias counts only as a run of WHOLE title tokens: "z6ii" is never
  // found inside "z6iii", "r5" inside "r50", or "z50" inside "z 50mm".
  const words = tokens(listing.title);
  const title = words.join("");
  const found = new Map<string, { camera: Camera; from: number; to: number }>();
  for (let i = 0; i < words.length; i++) {
    let key = "";
    for (let j = i; j < Math.min(words.length, i + MAX_ALIAS_TOKENS); j++) {
      key += words[j];
      for (const camera of index.aliases.get(key) ?? []) {
        const prev = found.get(camera.slug);
        if (!prev || prev.to - prev.from < j - i) found.set(camera.slug, { camera, from: i, to: j });
      }
    }
  }
  // A match lying inside another camera's longer match is not evidence
  // ("a7c" inside "a7c ii").
  const hits = [...found.values()];
  const kept = hits.filter((h) => !hits.some((o) => o !== h && o.to - o.from > h.to - h.from && o.from <= h.from && o.to >= h.to));
  if (kept.length === 0) return { camera: null, reason: "no alias" };
  if (kept.length > 1) return { camera: null, reason: `ambiguous: ${kept.map((h) => h.camera.slug).join(", ")}` };
  const camera = kept[0].camera;
  const brandOk = (BRAND_WORDS[camera.brand] ?? [camera.brand]).some((w) => lower.includes(w)) || camera.modelCodes.some((m) => title.includes(compact(m)));
  if (!brandOk) return { camera: null, reason: "brand not named" };
  return { camera, via: "title", kit: kitFor(camera) };
}

/**
 * Last line of defence against a mismatched listing: a body-only price far
 * below what the camera has ever sold for is a part, a scam or a different
 * camera. Floors are a share of the launch price; with no launch price, no
 * floor (the title rules above still apply).
 */
export function plausiblePrice(camera: Camera, condition: Condition, priceUsd: number): boolean {
  if (!camera.launchPriceUsd) return priceUsd > 50;
  const floor = condition === "new" ? 0.45 : 0.15;
  return priceUsd >= camera.launchPriceUsd * floor && priceUsd <= camera.launchPriceUsd * 2.5;
}
