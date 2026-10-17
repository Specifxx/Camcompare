// Everything a page needs from the catalog, parsed once per build.
// Pages only ever see PUBLISHED cameras: valid data, a thumbnail and a credit.
import fs from "node:fs";
import { readBrands, readCameraFiles, readMounts } from "./load";
import type { Brand, Camera, Mount } from "./schema";
import { readCredits, thumbPath, type ImageCredit } from "../images";
import { readHistory, readOffersFile, sortOffers, type Offer } from "../offers";

type Catalog = {
  cameras: Camera[];
  bySlug: Map<string, Camera>;
  brands: Brand[];
  mounts: Mount[];
  credits: Record<string, ImageCredit>;
  offers: Map<string, Offer[]>;
  offersGeneratedAt: string | null;
  history: Map<string, { day: string; new?: number; used?: number }[]>;
};

let memo: Catalog | null = null;

function load(): Catalog {
  if (memo) return memo;
  const { cameras: all } = readCameraFiles();
  const credits = readCredits();
  const cameras = all
    .filter((c) => credits[c.slug] && fs.existsSync(thumbPath(c.slug)))
    .sort((a, b) => b.announced.localeCompare(a.announced) || a.name.localeCompare(b.name));
  const live = new Set(cameras.map((c) => c.slug));
  const file = readOffersFile();
  const offers = new Map<string, Offer[]>();
  for (const o of file.offers) if (live.has(o.camera)) (offers.get(o.camera) ?? offers.set(o.camera, []).get(o.camera)!).push(o);
  for (const [k, v] of offers) offers.set(k, sortOffers(v));
  const history = new Map<string, { day: string; new?: number; used?: number }[]>();
  for (const d of readHistory()) for (const [slug, p] of Object.entries(d.prices)) if (live.has(slug)) (history.get(slug) ?? history.set(slug, []).get(slug)!).push({ day: d.day, ...p });
  memo = { cameras, bySlug: new Map(cameras.map((c) => [c.slug, c])), brands: readBrands(), mounts: readMounts(), credits, offers, offersGeneratedAt: file.generatedAt, history };
  return memo;
}

export const publishedCameras = () => load().cameras;
export const camera = (slug: string) => load().bySlug.get(slug) ?? null;
export const brands = () => load().brands;
export const brand = (slug: string) => load().brands.find((b) => b.slug === slug) ?? null;
export const mounts = () => load().mounts;
export const mount = (slug: string) => load().mounts.find((m) => m.slug === slug) ?? null;
export const credit = (slug: string) => load().credits[slug] ?? null;
export const offersFor = (slug: string) => load().offers.get(slug) ?? [];
export const historyFor = (slug: string) => load().history.get(slug) ?? [];
export const offersGeneratedAt = () => load().offersGeneratedAt;

/** Rival references that point at published cameras. */
export function rivalsOf(c: Camera): Camera[] {
  return c.rivals.map((s) => camera(s)).filter((x): x is Camera => x !== null);
}

/**
 * The comparisons that get their own indexed page: every rival pair named in
 * the catalog, once, in slug order. Only pairs a buyer genuinely cross-shops —
 * a page for every possible pair is the "scaled content" Google demotes.
 */
export function comparePairs(): [Camera, Camera][] {
  const seen = new Set<string>();
  const pairs: [Camera, Camera][] = [];
  for (const c of publishedCameras()) {
    for (const r of rivalsOf(c)) {
      const [a, b] = [c, r].sort((x, y) => x.slug.localeCompare(y.slug));
      const key = `${a.slug}|${b.slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([a, b]);
    }
  }
  return pairs;
}

export const pairSlug = (a: Camera, b: Camera) => {
  const [x, y] = [a, b].sort((p, q) => p.slug.localeCompare(q.slug));
  return `${x.slug}-vs-${y.slug}`;
};

export function parsePairSlug(s: string): [Camera, Camera] | null {
  const i = s.indexOf("-vs-");
  if (i < 0) return null;
  const a = camera(s.slice(0, i));
  const b = camera(s.slice(i + 4));
  return a && b ? [a, b] : null;
}

export function brandName(slug: string) {
  return brand(slug)?.name ?? slug;
}
