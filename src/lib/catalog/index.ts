// Everything a page needs from the catalog, parsed once per build.
// Pages only ever see PUBLISHED products: valid data and a photo, either a
// licensed thumbnail with its credit or, with none, a store's own listing
// photo of it (lib/store-photos.ts; owner, 2026-10-22).
import fs from "node:fs";
import { readBrands, readCameraFiles, readLensFiles, readMounts } from "./load";
import type { Brand, Camera, Lens, LensCoverage, Mount, ProductKind, SensorFormat } from "./schema";
import { readCredits, THUMBS_DIR, type ImageCredit } from "../images";
import { readStorePhotos, type StorePhoto } from "../store-photos";
import { MARKETS, type Currency, type MarketCode } from "../markets";
import { readAmazonOffers, readHistory, readOffersFile, sortOffers, type HistoryPoint, type Offer } from "../offers";

export type AnyProduct = { kind: "camera"; item: Camera } | { kind: "lens"; item: Lens };

type MarketOffers = { offers: Map<string, Offer[]>; generatedAt: string | null };

type Catalog = {
  cameras: Camera[];
  lenses: Lens[];
  bySlug: Map<string, AnyProduct>;
  brands: Brand[];
  mounts: Mount[];
  credits: Record<string, ImageCredit>;
  /** Store listing photos, only for products without a licensed one. */
  storePhotos: Record<string, StorePhoto>;
  // Parsed per market on first use: price history grows every day, and a
  // page reads one market's (a compare page none).
  offers: Partial<Record<MarketCode, MarketOffers>>;
  history: Partial<Record<MarketCode, Map<string, HistoryPoint[]>>>;
};

let memo: Catalog | null = null;

const newestFirst = <T extends { announced: string; name: string }>(a: T, b: T) => b.announced.localeCompare(a.announced) || a.name.localeCompare(b.name);

function load(): Catalog {
  if (memo) return memo;
  const credits = readCredits();
  // A server function has no public/ (the CDN serves it; next.config.js keeps
  // the thumbnails out of every function): there the credits decide, which
  // tests/catalog.test.ts holds to the files.
  const thumbs = fs.existsSync(THUMBS_DIR) ? new Set(fs.readdirSync(THUMBS_DIR)) : null;
  const licensed = (slug: string) => Boolean(credits[slug]) && (!thumbs || thumbs.has(`${slug}.webp`));
  // A licensed photo always wins; a store photo only stands in where there is none.
  const storePhotos = Object.fromEntries(Object.entries(readStorePhotos()).filter(([slug]) => !licensed(slug)));
  const published = (slug: string) => licensed(slug) || Boolean(storePhotos[slug]);
  const cameras = readCameraFiles().cameras.filter((c) => published(c.slug)).sort(newestFirst);
  const lenses = readLensFiles().lenses.filter((l) => published(l.slug)).sort(newestFirst);
  const bySlug = new Map<string, AnyProduct>([
    ...cameras.map((c) => [c.slug, { kind: "camera", item: c }] as const),
    ...lenses.map((l) => [l.slug, { kind: "lens", item: l }] as const),
  ]);
  memo = { cameras, lenses, bySlug, brands: readBrands(), mounts: readMounts(), credits, storePhotos, offers: {}, history: {} };
  return memo;
}

function marketOffers(m: MarketCode): MarketOffers {
  const c = load();
  if (c.offers[m]) return c.offers[m];
  const file = readOffersFile(m);
  const offers = new Map<string, Offer[]>();
  for (const o of [...file.offers, ...readAmazonOffers(m)]) if (c.bySlug.has(o.product)) (offers.get(o.product) ?? offers.set(o.product, []).get(o.product)!).push(o);
  for (const [k, v] of offers) offers.set(k, sortOffers(v));
  return (c.offers[m] = { offers, generatedAt: file.generatedAt });
}

function marketHistory(m: MarketCode): Map<string, HistoryPoint[]> {
  const c = load();
  if (c.history[m]) return c.history[m];
  const history = new Map<string, HistoryPoint[]>();
  for (const d of readHistory(m)) for (const [slug, p] of Object.entries(d.prices)) if (c.bySlug.has(slug)) (history.get(slug) ?? history.set(slug, []).get(slug)!).push({ day: d.day, ...p });
  return (c.history[m] = history);
}

export const publishedCameras = () => load().cameras;
export const publishedLenses = () => load().lenses;
export const product = (slug: string) => load().bySlug.get(slug) ?? null;
export const camera = (slug: string) => {
  const p = load().bySlug.get(slug);
  return p?.kind === "camera" ? p.item : null;
};
export const lens = (slug: string) => {
  const p = load().bySlug.get(slug);
  return p?.kind === "lens" ? p.item : null;
};
export const brands = () => load().brands;
export const brand = (slug: string) => load().brands.find((b) => b.slug === slug) ?? null;
export const brandName = (slug: string) => brand(slug)?.name ?? slug;
export const mounts = () => load().mounts;
export const mount = (slug: string) => load().mounts.find((m) => m.slug === slug) ?? null;
export const credit = (slug: string) => load().credits[slug] ?? null;
/** The store photo standing in for a product with no licensed thumbnail, or null. */
export const storePhoto = (slug: string): StorePhoto | null => load().storePhotos[slug] ?? null;
export const offersFor = (slug: string, m: MarketCode) => marketOffers(m).offers.get(slug) ?? [];
export const historyFor = (slug: string, m: MarketCode) => marketHistory(m).get(slug) ?? [];
export const offersGeneratedAt = (m: MarketCode) => marketOffers(m).generatedAt;
export const pricedSlugs = (m: MarketCode) => [...marketOffers(m).offers.keys()];
export const historyAll = (m: MarketCode) => marketHistory(m);

/** The name a market sells it under ("Canon EOS 2000D" outside North America). */
export function displayName(p: Camera | Lens, m: MarketCode): string {
  return (m !== "us" && p.regionalNames?.[m]) || p.name;
}
export function displayShortName(p: Camera | Lens, m: MarketCode): string {
  const regional = m !== "us" ? p.regionalNames?.[m] : undefined;
  if (!regional) return p.shortName;
  const b = brandName(p.brand);
  return regional.startsWith(`${b} `) ? regional.slice(b.length + 1) : regional;
}

/** Launch price in the market's currency, when we know it. */
export function launchPrice(p: Camera | Lens, m: MarketCode): { amount: number; currency: Currency } | null {
  const cur = MARKETS[m].currency;
  if (cur === "USD") return p.launchPriceUsd ? { amount: p.launchPriceUsd, currency: "USD" } : null;
  const v = p.launchPrices?.[cur];
  return v ? { amount: v, currency: cur } : null;
}

/** Rival references that point at published products of the same kind. */
export function rivalsOf(p: AnyProduct): AnyProduct[] {
  return p.item.rivals.map((s) => product(s)).filter((x): x is AnyProduct => x !== null && x.kind === p.kind);
}

// ------------------------------------------------------------ compatibility

// A lens covers every sensor no bigger than its image circle; the mount
// decides the rest (an APS-C lens made in Micro Four Thirds fits MFT bodies).
const COVERS: Record<LensCoverage, SensorFormat[]> = {
  "medium-format": ["medium-format", "full-frame", "aps-h", "super-35", "aps-c", "micro-four-thirds"],
  "full-frame": ["full-frame", "aps-h", "super-35", "aps-c", "micro-four-thirds"],
  "aps-c": ["aps-c", "super-35", "micro-four-thirds"],
  "micro-four-thirds": ["micro-four-thirds", "1-inch"], // GoPro MISSION 1 PRO ILS: a 1" sensor behind an MFT mount
};

/** Native lenses for a body: same mount, image circle big enough. (Adapters are a different page.) */
export function lensesFor(c: Camera): Lens[] {
  if (!c.mount) return [];
  return publishedLenses().filter((l) => l.mounts.includes(c.mount!) && COVERS[l.coverage].includes(c.specs.sensorFormat));
}

/** Bodies a lens fits natively, newest first. */
export function camerasFor(l: Lens): Camera[] {
  return publishedCameras().filter((c) => c.mount !== null && l.mounts.includes(c.mount) && COVERS[l.coverage].includes(c.specs.sensorFormat));
}

/** A lens made for a smaller sensor than the body: works only in crop mode. */
export const lensCropsOn = (l: Lens, c: Camera) => l.coverage === "aps-c" && ["full-frame", "aps-h"].includes(c.specs.sensorFormat);

// ------------------------------------------------------------ comparisons

/**
 * The comparisons that get their own page: every rival pair named in the
 * catalog, once, in slug order. Never every possible pair — that is the
 * "scaled content" Google demotes.
 */
export function comparePairs(kind?: ProductKind): [AnyProduct, AnyProduct][] {
  const seen = new Set<string>();
  const pairs: [AnyProduct, AnyProduct][] = [];
  for (const p of load().bySlug.values()) {
    if (kind && p.kind !== kind) continue;
    for (const r of rivalsOf(p)) {
      const [a, b] = [p, r].sort((x, y) => x.item.slug.localeCompare(y.item.slug));
      const key = `${a.item.slug}|${b.item.slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([a, b]);
    }
  }
  return pairs;
}

/**
 * A pair is indexed (sitemap, no noindex) only when BOTH products name each
 * other as rivals: the strongest cross-shops. One-sided pairs still get a page
 * for visitors, marked noindex. RiftCompare's lesson: publish fewer pages.
 */
export const isIndexedPair = (a: AnyProduct, b: AnyProduct) => a.item.rivals.includes(b.item.slug) && b.item.rivals.includes(a.item.slug);
export const indexedPairs = (kind?: ProductKind) => comparePairs(kind).filter(([a, b]) => isIndexedPair(a, b));

export const pairSlug = (a: { slug: string }, b: { slug: string }) => {
  const [x, y] = [a, b].sort((p, q) => p.slug.localeCompare(q.slug));
  return `${x.slug}-vs-${y.slug}`;
};

export function parsePairSlug(s: string): [AnyProduct, AnyProduct] | null {
  const i = s.indexOf("-vs-");
  if (i < 0) return null;
  const a = product(s.slice(0, i));
  const b = product(s.slice(i + 4));
  return a && b && a.kind === b.kind ? [a, b] : null;
}

export const productPath = (p: AnyProduct | { kind: ProductKind; slug: string }) => {
  const slug = "item" in p ? p.item.slug : p.slug;
  return `/${p.kind === "camera" ? "cameras" : "lenses"}/${slug}`;
};
