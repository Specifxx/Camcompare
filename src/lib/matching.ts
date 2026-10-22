// Decides which catalog product (camera body or lens) a retailer listing is,
// or that it is none.
//
// Order of evidence: GTIN (exact), then maker part number, then the title.
// Title matching is where listings go wrong, so it is strict:
//  - the brand (or a sub-brand like Lumix, Pentax, Olympus, Rokinon) must be named;
//  - an alias only counts as a run of whole title words, so it can never be
//    the front of another model ("Z6 II" in "Z6 III", "R5" in "R50", "Z 50"
//    in "Z 50mm");
//  - alias keys drop a leading brand name ("Sony a7C" → "a7C"): the brand is
//    checked on its own, and a brand-prefixed key would otherwise out-span
//    the successor's ("Sony a7C" against "a7C II");
//  - only products whose brand the title names are candidates; then the
//    longest match wins ("a7C" vs "a7C II"), and two different products of
//    the same kind left standing means the listing is refused, not guessed;
//  - a model followed by a generation mark the catalog doesn't have ("R6
//    Mark III" when only the R6 exists) is refused, not read as the older one;
//  - accessories, parts and film bodies are refused outright;
//  - a camera named alongside a lens is a kit (for a camera) and never a
//    lens offer; a camera named after "for" ("… for Sony a6400") is only a
//    compatibility note on a lens listing.
// A wrong match puts a wrong price on a page, so every rule here is one-way:
// it can only refuse a listing, never invent one.
import type { Camera, Lens, ProductKind } from "./catalog/schema";
import { refRate, type Currency } from "./markets";
import type { Condition } from "./retailers";

const ROMAN: Record<string, string> = { "1": "i", "2": "ii", "3": "iii", "4": "iv", "5": "v", "6": "vi" };

/**
 * Lowercase, "Mark II"/"Mk2"/"MkII" → "ii", α → a, split on anything but
 * a-z0-9. A decimal stays one word ("2.8" → "28"), so "GM 2.8" can't read
 * as "GM2".
 */
export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/α/g, "a")
    .replace(/(\d)\.(?=\d)/g, "$1")
    .replace(/\b(?:mark|mk)\.?\s*([1-6]|i{1,3}|iv|vi?)\b/g, (_, n: string) => ` ${ROMAN[n] ?? n}`)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export const compact = (s: string) => tokens(s).join("");

export const BRAND_WORDS: Record<string, string[]> = {
  sony: ["sony"],
  canon: ["canon"],
  nikon: ["nikon", "nikkor"],
  fujifilm: ["fujifilm", "fuji", "fujinon"],
  panasonic: ["panasonic", "lumix"],
  "om-system": ["om system", "omsystem", "om digital", "olympus", "zuiko"],
  leica: ["leica"],
  ricoh: ["ricoh", "pentax"],
  sigma: ["sigma"],
  hasselblad: ["hasselblad"],
  gopro: ["gopro"],
  dji: ["dji"],
  insta360: ["insta360"],
  blackmagic: ["blackmagic"],
  red: ["red"],
  tamron: ["tamron"],
  samyang: ["samyang", "rokinon"],
  viltrox: ["viltrox"],
  tokina: ["tokina"],
  laowa: ["laowa", "venus optics"],
  ttartisan: ["ttartisan", "tt artisan"],
  "7artisans": ["7artisans", "7 artisans"],
  zeiss: ["zeiss"],
  voigtlander: ["voigtlander"],
  sirui: ["sirui"],
  meike: ["meike"],
};

// Lens mount words in titles → catalog mount slug, for third-party lens versions.
const MOUNT_WORDS: [RegExp, string][] = [
  [/\b(sony\s*(fe|e)(\s*-?\s*mount)?|e-mount|e mount|fe mount)\b/, "sony-e"],
  [/\b(canon\s*rf|rf-?mount|rf mount)\b/, "canon-rf"],
  [/\b(canon\s*ef-m|ef-m mount)\b/, "canon-ef-m"],
  [/\b(canon\s*ef(?!-m)(-s)?|ef-?mount|ef mount)\b/, "canon-ef"],
  [/\b(nikon\s*z|z-?mount|z mount)\b/, "nikon-z"],
  [/\b(nikon\s*f|f-?mount|f mount)\b/, "nikon-f"],
  [/\b(fuji(film)?\s*x|x-?mount|x mount)\b/, "fujifilm-x"],
  [/\b(fuji(film)?\s*g|g-?mount|gfx mount)\b/, "fujifilm-g"],
  [/\b(l-?mount|l mount|leica\s*l)\b/, "l-mount"],
  [/\b(micro four thirds|micro 4\/3|m4\/3|mft)\b/, "micro-four-thirds"],
  [/\b(pentax\s*k|k-?mount|k mount)\b/, "pentax-k"],
  [/\b(leica\s*m|m-?mount)\b/, "leica-m"],
];

// Listings that are not a working camera or lens, parts pulled from one
// included. Checked on the lowercased title. Never a bare spec word ("CMOS
// sensor", "LCD display"): real titles list those.
const PARTS =
  /\b(for parts|parts only|not working|(doesn['’]?t|does not|don['’]?t|do not) work(ing|s)?|not functioning|defective|damaged|broken|as[- ]is|repair|replacement|untested|spares|faulty|box only|empty box|dummy|replica|manual only|rental|(image )?sensor (unit|assembly|board)|main ?board|logic board|flex cable|shutter (assembly|unit|block)|(lcd|display|screen) (assembly|module)|(lens|glass) (element|group)|element (glass|group))\b/;
// Accessories sold "for" a camera: batteries, grips, cages… (camera listings only).
const CAMERA_ACCESSORY =
  /\b(battery|batteries|charger|grip|cage|strap|case|bag|protector|skin|decal|cover|eyecup|eye cup|body cap|remote|cable|bracket|plate|hot ?shoe|microphone|gimbal|tripod|speedlite|flash unit|memory card|sd card|cfexpress card|motherboard|lcd screen|eyepiece|top handle|handle unit|(lens|media|light|display|filter) mods?|sensor cleaning|lens only|teleconverter|extension tube|viewfinder only|evf only|housing|mount adapter)\b/;
const FOR_PHRASE = /\b(for|fits|compatible with)\s+(the\s+)?(sony|canon|nikon|fuji|fujifilm|panasonic|lumix|olympus|om system|leica|ricoh|pentax|sigma|hasselblad|gopro|dji|insta360|blackmagic)\b/;
// Lens accessories name the lens after "for": "Lens hood for Sony FE 24-70mm GM II".
const LENS_ACCESSORY = /\b(hood|cap|caps|filter|case|pouch|collar|tripod foot|adapter|cover|protector|skin|wrap|bag|ring|teleconverter|extender|extension tube)\b[^,()]*\b(for|fits|compatible with)\b/;
// …or after the lens ("Canon EF 24-70mm f/2.8L II USM Lens Hood EW-88C"),
// unless something before it says it comes with the lens ("w/ hood & caps").
const LENS_PART = /\b(lens hood|hood only|(lens|front|rear) caps?|tripod (mount )?ring|tripod (collar|foot))\b/;
// An accessory named first, then the product it fits after a dash or colon:
// "NiSi JetMag Pro … Magnetic Filter Kit - Sony FE 14mm f/1.8 GM".
const ACCESSORY_BEFORE_DASH = /^[^-–—:|]*\b(filters?|filter (kit|holder|system)|nd|cpl|polari[sz]er|holder|hood|lens caps?|case|pouch|step[- ]up|cage|grip|battery|charger|strap|protector)\b[^-–—:|]*\s[-–—:|]\s/;
const INCLUDED = /\bwith\b|\bw\/|\bincl|\band\b|[+&]/;
// Film bodies share names with digital ones (Olympus OM-1, Canon EOS 5).
const FILM = /\b(film|35mm slr|slr film|half[- ]frame)\b/;
// A zoom or prime named next to an interchangeable-lens body means a kit,
// its lens prefix glued on or not ("with XC15-45mm", "RF-S18-45mm").
const KIT = /\bkit\b|\bbundle\b|\bw\/\s*\d|\bwith\s+(an?\s+)?([\w-]+\s+){0,3}[a-z-]*\d{2,3}(-\d{2,3})?\s*mm|\b[a-z]{0,4}-?\d{2,3}-\d{2,3}\s*mm\b|\blens(es)? (kit|bundle)\b/;
const BODY_ONLY = /\bbody( only)?\b/;
// "Body" cancels KIT ("body only, fits 24-70mm"), but not a lens added with "+".
const KIT_PLUS = /\+\s*(\w+\s+)?[a-z-]*\d{2,3}(-\d{2,3})?\s*mm/;

/** What the matcher needs from a camera or a lens. */
export type Matchable = {
  kind: ProductKind;
  slug: string;
  brand: string;
  shortName: string;
  aliases: string[];
  modelCodes: string[];
  gtins: string[];
  launchPriceUsd: number | null;
  launchPrices?: Partial<Record<Exclude<Currency, "USD">, number>>;
  /** Cameras: interchangeable-lens body (kits possible). */
  interchangeable: boolean;
  /** Lenses: the mounts it is made for. */
  mounts: string[];
};

export const cameraMatchable = (c: Camera): Matchable => ({
  kind: "camera",
  slug: c.slug,
  brand: c.brand,
  shortName: c.shortName,
  aliases: c.aliases,
  modelCodes: c.modelCodes,
  gtins: c.gtins,
  launchPriceUsd: c.launchPriceUsd,
  launchPrices: c.launchPrices,
  interchangeable: c.mount !== null,
  mounts: c.mount ? [c.mount] : [],
});

export const lensMatchable = (l: Lens): Matchable => ({
  kind: "lens",
  slug: l.slug,
  brand: l.brand,
  shortName: l.shortName,
  aliases: l.aliases,
  modelCodes: l.modelCodes,
  gtins: l.gtins,
  launchPriceUsd: l.launchPriceUsd,
  launchPrices: l.launchPrices,
  interchangeable: false,
  mounts: l.mounts,
});

export type CatalogIndex = {
  byGtin: Map<string, Matchable>;
  byModelCode: Map<string, Matchable>;
  aliases: Map<string, Matchable[]>; // compacted alias → products (one, unless the catalog has a clash)
  bySlug: Map<string, Matchable>;
};

const MAX_ALIAS_TOKENS = 12;

// Model names that are an everyday word once the brand is dropped ("OM
// SYSTEM PEN" → "pen", "GoPro MAX" → "max"). Stripped, the key would match
// every Olympus PEN E-PL or "Pen" in a title; kept whole, it needs the brand
// right before it.
const WORD_MODELS = new Set(["pen", "max"]);

/**
 * The keys a product's names are matched under: each alias, model code and
 * short name as joined title words, minus any leading brand words. Used by
 * the index and by catalog:check, so both see the same clashes.
 */
export function aliasKeys(p: Pick<Matchable, "brand" | "aliases" | "modelCodes" | "shortName">): string[] {
  const brandTokens = (BRAND_WORDS[p.brand] ?? [p.brand]).map(tokens);
  const keys = new Set<string>();
  for (const name of [...p.aliases, ...p.modelCodes, p.shortName]) {
    const whole = tokens(name);
    let t = whole;
    for (let b = brandTokens.find((bt) => bt.length < t.length && bt.every((w, i) => t[i] === w)); b; b = brandTokens.find((bt) => bt.length < t.length && bt.every((w, i) => t[i] === w))) t = t.slice(b.length);
    if (t.length === 1 && WORD_MODELS.has(t[0])) {
      if (t === whole) continue; // the bare word (a shortName "PEN") is no evidence at all
      t = whole;
    }
    const key = t.join("");
    if (key.length >= 2) keys.add(key);
  }
  return [...keys];
}

export function buildIndex(cameras: Camera[], lenses: Lens[] = []): CatalogIndex {
  const byGtin = new Map<string, Matchable>();
  const byModelCode = new Map<string, Matchable>();
  const aliases = new Map<string, Matchable[]>();
  const bySlug = new Map<string, Matchable>();
  for (const p of [...cameras.map(cameraMatchable), ...lenses.map(lensMatchable)]) {
    bySlug.set(p.slug, p);
    for (const g of p.gtins) byGtin.set(normalizeGtin(g), p);
    for (const m of p.modelCodes) byModelCode.set(compact(m), p);
    for (const key of aliasKeys(p)) aliases.set(key, [...(aliases.get(key) ?? []), p]);
  }
  return { byGtin, byModelCode, aliases, bySlug };
}

/** UPC-A (12) and EAN-13 with a leading 0 are the same product. */
export function normalizeGtin(g: string): string {
  return g.replace(/\D/g, "").replace(/^0+/, "");
}

export type Listing = { title: string; gtin?: string | null; mpn?: string | null };
export type MatchVia = "gtin" | "mpn" | "title";
export type MatchResult =
  | { product: Matchable; kind: ProductKind; via: MatchVia; kit: boolean; mount: string | null }
  | { product: null; reason: string };

function brandNamed(p: Matchable, words: string[], compactTitle: string): boolean {
  const names = BRAND_WORDS[p.brand] ?? [p.brand];
  return names.some((n) => {
    const c = compact(n);
    return c.length >= 5 ? compactTitle.includes(c) : words.includes(c);
  });
}

/** The lens mount a title names, if it names exactly one. */
export function mountInTitle(lower: string): string | null {
  const found = new Set(MOUNT_WORDS.filter(([re]) => re.test(lower)).map(([, m]) => m));
  return found.size === 1 ? [...found][0] : null;
}

type Hit = { p: Matchable; from: number; to: number };

// A word right after a model name that makes it a different model: a
// generation ("ii", "Mark 3" → "iii") or, for bodies, a variant letter.
const GENERATION = /^(?:ii|iii|iv|v|vi|vii|viii|ix)$/;
// A digit with a letter or two is a newer model too ("Osmo Pocket 4P" after
// "Osmo Pocket"), but not a video resolution ("R5 8K", "a7 IV 4K").
const BODY_VARIANT = /^(?:\d|\d(?!k$)[a-z]{1,2}|s|r|c|pro|plus|max|mini|lite|ultra|se)$/;

function aliasHits(words: string[], index: CatalogIndex): Hit[] {
  const found = new Map<string, Hit>();
  for (let i = 0; i < words.length; i++) {
    let key = "";
    for (let j = i; j < Math.min(words.length, i + MAX_ALIAS_TOKENS); j++) {
      key += words[j];
      for (const p of index.aliases.get(key) ?? []) {
        const prev = found.get(p.slug);
        if (!prev || prev.to - prev.from < j - i) found.set(p.slug, { p, from: i, to: j });
      }
    }
  }
  const hits = [...found.values()];
  // A match lying inside another product's longer match is not evidence ("a7c" inside "a7c ii").
  return hits.filter((h) => !hits.some((o) => o !== h && o.to - o.from > h.to - h.from && o.from <= h.from && o.to >= h.to));
}

export function matchListing(listing: Listing, index: CatalogIndex, want?: ProductKind): MatchResult {
  const lower = listing.title.toLowerCase();
  if (PARTS.test(lower)) return { product: null, reason: "parts/broken" };
  if (FILM.test(lower)) return { product: null, reason: "film camera" };

  const finish = (p: Matchable, via: MatchVia): MatchResult => {
    if (ACCESSORY_BEFORE_DASH.test(lower)) return { product: null, reason: "accessory named before the product" };
    if (want && p.kind !== want) return { product: null, reason: `is a ${p.kind}` };
    if (p.kind === "camera") {
      if (CAMERA_ACCESSORY.test(lower)) return { product: null, reason: "accessory/part" };
      if (FOR_PHRASE.test(lower)) return { product: null, reason: "accessory phrasing" };
      return { product: p, kind: "camera", via, kit: p.interchangeable && (KIT_PLUS.test(lower) || (KIT.test(lower) && !BODY_ONLY.test(lower))), mount: p.mounts[0] ?? null };
    }
    if (LENS_ACCESSORY.test(lower)) return { product: null, reason: "lens accessory" };
    const part = LENS_PART.exec(lower);
    if (part && !INCLUDED.test(lower.slice(0, part.index))) return { product: null, reason: "lens accessory" };
    const named = mountInTitle(lower);
    if (named && !p.mounts.includes(named)) return { product: null, reason: `mount ${named} is not a version of this lens` };
    return { product: p, kind: "lens", via, kit: false, mount: named ?? (p.mounts.length === 1 ? p.mounts[0] : null) };
  };

  if (listing.gtin) {
    const p = index.byGtin.get(normalizeGtin(listing.gtin));
    if (p) return finish(p, "gtin");
  }
  const words = tokens(listing.title);
  const title = words.join("");
  if (listing.mpn) {
    // Dealers append a colour or region: "ILCE-7M4/B", "ILCE-7M4/B BODY".
    // Part numbers aren't unique across makers (Nikon's are bare 4-5 digit
    // numbers), so the title must still name the brand.
    const p = index.byModelCode.get(compact(listing.mpn)) ?? index.byModelCode.get(compact(listing.mpn.split("/")[0]));
    if (p && brandNamed(p, words, title)) return finish(p, "mpn");
  }

  let hits = aliasHits(words, index);
  // "… for Sony a6400": a camera named after "for/fits" is a compatibility note.
  hits = hits.filter((h) => !(h.p.kind === "camera" && words.slice(Math.max(0, h.from - 2), h.from).some((w) => w === "for" || w === "fits")));
  if (!hits.length) return { product: null, reason: "no alias" };
  // A model code stands in for the brand only when it is distinctive: a short
  // one ("S-S20" → "ss20", Panasonic's 20mm) is also a QED speaker switch.
  hits = hits.filter((h) => brandNamed(h.p, words, title) || h.p.modelCodes.some((m) => compact(m).length >= 6 && title.includes(compact(m))));
  if (!hits.length) return { product: null, reason: "brand not named" };
  const cams = hits.filter((h) => h.p.kind === "camera");
  const lenses = hits.filter((h) => h.p.kind === "lens");

  let pick: Hit[];
  if (cams.length && lenses.length) {
    // A body named with a lens: a kit. Never a price for the lens alone.
    if (want === "lens") return { product: null, reason: "camera kit" };
    pick = cams;
  } else {
    pick = cams.length ? cams : lenses;
  }
  if (pick.length > 1) return { product: null, reason: `ambiguous: ${pick.map((h) => h.p.slug).join(", ")}` };
  const p = pick[0].p;
  // Panasonic named bodies DMC-… until 2016 and DC-… since: "Lumix DMC-L10"
  // (2007) is not the Lumix L10 (2026).
  if (p.brand === "panasonic" && words[pick[0].from - 1] === "dmc" && !p.modelCodes.some((m) => compact(m).startsWith("dmc"))) return { product: null, reason: "DMC- model: an older Panasonic" };
  const next = words[pick[0].to + 1] ?? "";
  if (GENERATION.test(next) || (p.kind === "camera" && BODY_VARIANT.test(next) && words[pick[0].to + 2] !== "mount")) return { product: null, reason: `"${next}" after the name: a model we don't list` };
  const r = finish(p, "title");
  if (r.product && r.kind === "camera" && lenses.length) return { ...r, kit: true };
  return r;
}

/**
 * The launch price in `currency`, for sanity floors only (never shown): the
 * market's own if we have it, else the US one, else any other market's, at
 * reference rates.
 */
export function launchIn(p: Pick<Matchable, "launchPriceUsd" | "launchPrices">, currency: Currency): number | null {
  const own = currency === "USD" ? p.launchPriceUsd : p.launchPrices?.[currency];
  if (own) return own;
  const [from, v] = p.launchPriceUsd ? ["USD", p.launchPriceUsd] : (Object.entries(p.launchPrices ?? {})[0] ?? []);
  return v ? (v / refRate(from as Currency)) * refRate(currency) : null;
}

/**
 * Last line of defence against a mismatched listing: a price far below what
 * the product has ever sold for is a part, a scam or a different product.
 * Floors are a share of the launch price in the listing's currency
 * (`launchIn`). With no launch price at all there is nothing to hold a price
 * against, and a hood or a top handle titled with the product's name would
 * pass: then only a GTIN or part-number match is trusted, over a token floor.
 */
export function plausiblePrice(p: Pick<Matchable, "launchPriceUsd" | "launchPrices">, condition: Condition, price: number, currency: Currency = "USD", via: MatchVia = "title"): boolean {
  const launch = launchIn(p, currency);
  if (!launch) return via !== "title" && price > 30 * refRate(currency);
  const floor = condition === "new" ? 0.4 : 0.12;
  return price >= launch * floor && price <= launch * 2.5;
}

// ---------------------------------------------------------------- kit lenses

// A lens as a kit title names it: optional prefix words ("RF-S", "NIKKOR Z
// DX", "M.Zuiko Digital ED"), the focal length or range, the aperture, then
// designators ("IS STM", "OSS", "G", "WR"). Built for the text, not for
// matching: what the listing calls its lens, cleaned.
const NOT_PREFIX = "(?!(?:II|III|IV|VI|KIT|BODY|AND|WITH|W|PLUS|BONUS|BLACK|SILVER|CAMERA|MIRRORLESS|DSLR|DIGITAL CAMERA)\\b)";
const LENS_NAME = new RegExp(
  `(?:\\b${NOT_PREFIX}(?:[A-Z]{1,6}(?:-[A-Z]{1,2})?|NIKKOR|Nikkor|M\\.\\s?Zuiko|M\\.ZUIKO|Zuiko|ZUIKO|Digital|DIGITAL|ED|Lumix|LUMIX|Vario|Fujinon|FUJINON)\\s+){0,3}` +
    `(?:[A-Z]{1,4}(?:-[A-Z])?)?\\d{1,3}(?:\\.\\d)?(?:\\s?-\\s?\\d{1,3}(?:\\.\\d)?)?\\s?[mM]{2}(?![a-eg-zA-EG-Z])` +
    `(?:\\s*(?:[fF]\\/?|1:)\\s?\\d{1,2}(?:\\.\\d{1,2})?(?:\\s?-\\s?\\d{1,2}(?:\\.\\d{1,2})?)?)?` +
    `(?:\\s+${NOT_PREFIX}(?:[A-Z]{1,4}|II|III|IV|Macro|MACRO|OSS|STM|USM|VR|WR|OIS|ASPH\\.?|Power|POWER|PZ|LM|DN|DG|DC|HSM|Di|VXD|RXD|IS|G|GM|S|L|R|Pro|PRO|IF|AF-S|AF-P|DX|Master|MASTER|Lens|LENS)\\b)*`,
  "g",
);

/** Every lens a kit title names with a focal length, as it names them ("RF-S 18-45mm f/4.5-6.3 IS STM"). */
export function kitLensNames(title: string): string[] {
  return [...title.matchAll(LENS_NAME)].map((m) => m[0].replace(/\s+/g, " ").replace(/\s+(lens|kit)$/i, "").trim()).filter((s) => /\d\s?mm/i.test(s));
}

type KitLensCatalog = { slug: string; brand: string; mounts: string[]; specs: { focalMinMm: number; focalMaxMm: number; apertureMax: number; apertureMaxTele: number | null } };

/**
 * The catalog lens in a camera kit, and the lens as the listing names it.
 * `kitLensName` is filled whenever the title gives a focal length (several
 * joined with " + "). `kitLens` only when exactly one catalog lens for the
 * camera's mount fits: by alias (its brand named, or the camera's maker),
 * else by focal range and, when the title gives one, aperture, among the
 * camera maker's lenses (or the lens maker the title names). A twin-lens kit,
 * or two lenses that fit, gives no slug: refused, never guessed.
 */
export function kitLensOf(title: string, index: CatalogIndex, lenses: KitLensCatalog[], camera: Pick<Matchable, "brand" | "mounts">): { kitLens: string | null; kitLensName: string | null } {
  const names = kitLensNames(title);
  const kitLensName = names.length ? names.join(" + ").slice(0, 120) : null;
  const mount = camera.mounts[0];
  if (!mount) return { kitLens: null, kitLensName };
  const words = tokens(title);
  const joined = words.join("");
  const lensHits = aliasHits(words, index).filter((h) => h.p.kind === "lens" && h.p.mounts.includes(mount) && (h.p.brand === camera.brand || brandNamed(h.p, words, joined)));
  const bySlug = new Set(lensHits.map((h) => h.p.slug));
  if (bySlug.size === 1 && names.length <= 1) return { kitLens: [...bySlug][0], kitLensName };
  if (bySlug.size > 1 || names.length !== 1) return { kitLens: null, kitLensName };
  // By focal range among the mount's lenses of the camera maker (or the named lens maker).
  const m = names[0].match(/(\d{1,3}(?:\.\d)?)(?:\s?-\s?(\d{1,3}(?:\.\d)?))?\s?mm(?:\s*(?:f\/?|1:)\s?(\d{1,2}(?:\.\d{1,2})?)(?:\s?-\s?(\d{1,2}(?:\.\d{1,2})?))?)?/i);
  if (!m) return { kitLens: null, kitLensName };
  const lo = Number(m[1]);
  const hi = m[2] ? Number(m[2]) : lo;
  const f1 = m[3] ? Number(m[3]) : null;
  const f2 = m[4] ? Number(m[4]) : null;
  const named = Object.entries(BRAND_WORDS).find(([b, ws]) => b !== camera.brand && ws.some((w) => (compact(w).length >= 5 ? joined.includes(compact(w)) : words.includes(compact(w)))) && lenses.some((l) => l.brand === b && l.mounts.includes(mount)));
  const brand = named?.[0] ?? camera.brand;
  const fits = lenses.filter(
    (l) =>
      l.brand === brand &&
      l.mounts.includes(mount) &&
      l.specs.focalMinMm === lo &&
      l.specs.focalMaxMm === hi &&
      (f1 === null || l.specs.apertureMax === f1) &&
      (f2 === null || (l.specs.apertureMaxTele ?? l.specs.apertureMax) === f2),
  );
  return { kitLens: fits.length === 1 ? fits[0].slug : null, kitLensName };
}
