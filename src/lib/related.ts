// What a product page links to besides itself: "More options" (family and
// rivals), "Alternatives" (similar spec and launch price, any brand), "More
// from <brand>" and "More for <mount>"; and the A-Z index on /cameras and
// /lenses. Plain links in the server HTML, so every product is a few clicks
// from the home page for a crawler as well as a visitor (Search Console,
// 2026-10-25: pages "Discovered, not indexed" sat three clicks deep with one
// or two links in). DECISIONS.md, "Indexing: canonicals, hreflang and
// internal links".
//
// Market-independent on purpose: the same picks on every market's version of
// a page, from catalog facts (sensor, focal range, launch price in USD), not
// from today's offers, which would reshuffle the links with every import.
// Server-only (reads the catalog).
import { brands, product, publishedCameras, publishedLenses, rivalsOf, type AnyProduct } from "./catalog";
import type { Camera, Lens } from "./catalog/schema";
import { lensCategories } from "./specs/lens";
import { lineSiblings } from "./things-to-know";

export type Pick = { p: AnyProduct; why: string };

const asProduct = (x: Camera | Lens): AnyProduct | null => product(x.slug);
const years = (a: string, b: string) => Math.abs(Number(a.slice(0, 4)) - Number(b.slice(0, 4)));
const priceGap = (a: number | null, b: number | null) => (a && b ? Math.abs(Math.log(a / b)) : null);

/** "More options": the successor and predecessor, same-line siblings, then the catalog's rivals. */
export function moreOptions(self: AnyProduct, max = 6): Pick[] {
  const it = self.item;
  const seen = new Set<string>([it.slug]);
  const picks: Pick[] = [];
  const add = (p: AnyProduct | null, why: string) => {
    if (!p || seen.has(p.item.slug) || p.kind !== self.kind) return;
    seen.add(p.item.slug);
    picks.push({ p, why });
  };
  add(it.successor ? product(it.successor) : null, "Newer model");
  for (const s of lineSiblings(it, self.kind)) add(product(s.slug), s.announced > it.announced ? "Newer model" : "Same line");
  add(it.predecessor ? product(it.predecessor) : null, "Older model");
  for (const r of rivalsOf(self)) add(r, "Rival");
  return picks.slice(0, max);
}

function cameraScore(a: Camera, b: Camera): number | null {
  if ((a.mount === null) !== (b.mount === null) || a.type !== b.type) return null;
  if (a.specs.sensorFormat !== b.specs.sensorFormat) return null;
  const gap = priceGap(a.launchPriceUsd, b.launchPriceUsd);
  if (gap !== null && gap > Math.log(1.8)) return null;
  return (gap ?? 0.6) + Math.abs(a.specs.megapixels - b.specs.megapixels) / 30 + years(a.announced, b.announced) / 4 + (a.brand === b.brand ? 0.15 : 0);
}

function lensScore(a: Lens, b: Lens): number | null {
  if (a.coverage !== b.coverage || !a.mounts.some((x) => b.mounts.includes(x))) return null;
  const zoom = (l: Lens) => l.specs.focalMaxMm > l.specs.focalMinMm;
  if (zoom(a) !== zoom(b)) return null;
  const main = lensCategories(a)[0];
  if (main && !lensCategories(b).includes(main)) return null;
  const f = Math.abs(Math.log(a.specs.focalMinMm / b.specs.focalMinMm)) + Math.abs(Math.log(a.specs.focalMaxMm / b.specs.focalMaxMm));
  if (f > 0.7) return null;
  const gap = priceGap(a.launchPriceUsd, b.launchPriceUsd);
  if (gap !== null && gap > Math.log(2.2)) return null;
  return f * 2 + Math.abs(Math.log(a.specs.apertureMax / b.specs.apertureMax)) + (gap ?? 0.6) * 0.6 + years(a.announced, b.announced) / 8 + (a.brand === b.brand ? 0.1 : 0);
}

/** Similar products buyers might weigh up instead: same kind and class, close in spec and launch price, any brand. */
export function alternatives(self: AnyProduct, exclude: Set<string> = new Set(), n = 6): AnyProduct[] {
  const scored: { x: Camera | Lens; s: number }[] = [];
  if (self.kind === "camera") {
    for (const c of publishedCameras()) {
      if (c.slug === self.item.slug || exclude.has(c.slug)) continue;
      const s = cameraScore(self.item, c);
      if (s !== null) scored.push({ x: c, s });
    }
  } else {
    for (const l of publishedLenses()) {
      if (l.slug === self.item.slug || exclude.has(l.slug)) continue;
      const s = lensScore(self.item, l);
      if (s !== null) scored.push({ x: l, s });
    }
  }
  return scored
    .sort((a, b) => a.s - b.s || a.x.slug.localeCompare(b.x.slug))
    .slice(0, n)
    .map(({ x }) => asProduct(x))
    .filter((x): x is AnyProduct => x !== null);
}

const byCloseness = (it: Camera | Lens) => (a: Camera | Lens, b: Camera | Lens) =>
  years(a.announced, it.announced) - years(b.announced, it.announced) || b.announced.localeCompare(a.announced) || a.slug.localeCompare(b.slug);

/** More of the same kind from the same maker, cameras on the same mount first; nearest in date. */
export function sameBrand(self: AnyProduct, exclude: Set<string> = new Set(), n = 8): AnyProduct[] {
  const it = self.item;
  const pool: (Camera | Lens)[] = self.kind === "camera" ? publishedCameras() : publishedLenses();
  // Cameras: same mount, then same sensor size. Lenses: a mount in common, then the same coverage.
  const near = (x: Camera | Lens) =>
    self.kind === "camera"
      ? Number((x as Camera).mount === (it as Camera).mount) * 2 + Number((x as Camera).specs.sensorFormat === (it as Camera).specs.sensorFormat)
      : Number((x as Lens).mounts.some((mt) => (it as Lens).mounts.includes(mt))) * 2 + Number((x as Lens).coverage === (it as Lens).coverage);
  return pool
    .filter((x) => x.brand === it.brand && x.slug !== it.slug && !exclude.has(x.slug))
    .sort((a, b) => near(b) - near(a) || byCloseness(it)(a, b))
    .slice(0, n)
    .map(asProduct)
    .filter((x): x is AnyProduct => x !== null);
}

/**
 * The same mount: bodies for a body, the same sensor size first, then other
 * makers (L-mount, Micro Four Thirds, Sony E with Blackmagic and Sigma);
 * lenses of the same kind and coverage for a lens, third-party first. A
 * fixed-lens camera has none.
 */
export function sameMount(self: AnyProduct, exclude: Set<string> = new Set(), n = 8): { mount: string; list: AnyProduct[] } | null {
  const it = self.item;
  if (self.kind === "camera") {
    const c = it as Camera;
    if (!c.mount) return null;
    const sensor = (x: Camera) => Number(x.specs.sensorFormat === c.specs.sensorFormat);
    const list = publishedCameras()
      .filter((x) => x.mount === c.mount && x.slug !== c.slug && !exclude.has(x.slug))
      .sort((a, b) => sensor(b) - sensor(a) || Number(a.brand === c.brand) - Number(b.brand === c.brand) || byCloseness(c)(a, b))
      .slice(0, n);
    return { mount: c.mount, list: list.map(asProduct).filter((x): x is AnyProduct => x !== null) };
  }
  const l = it as Lens;
  const mt = l.mounts[0];
  const cats = lensCategories(l);
  const list = publishedLenses()
    .filter((x) => x.mounts.includes(mt) && x.slug !== l.slug && !exclude.has(x.slug) && x.coverage === l.coverage)
    .map((x) => ({ x, shared: lensCategories(x).filter((k) => cats.includes(k)).length }))
    .filter(({ shared }) => shared > 0)
    .sort((a, b) => Number(a.x.brand === l.brand) - Number(b.x.brand === l.brand) || b.shared - a.shared || byCloseness(l)(a.x, b.x))
    .slice(0, n)
    .map(({ x }) => asProduct(x))
    .filter((x): x is AnyProduct => x !== null);
  return { mount: mt, list };
}

/** Every block a product page links to, with no product in two of them. */
export function relatedFor(self: AnyProduct) {
  const more = moreOptions(self);
  const seen = new Set([self.item.slug, ...more.map((x) => x.p.item.slug)]);
  const take = (list: AnyProduct[]) => {
    for (const p of list) seen.add(p.item.slug);
    return list;
  };
  const alts = take(alternatives(self, seen));
  const brand = take(sameBrand(self, seen));
  const mt = sameMount(self, seen);
  if (mt) take(mt.list);
  return { more, alternatives: alts, sameBrand: brand, sameMount: mt };
}

/** /cameras and /lenses: every published product, grouped by brand A-Z, names A-Z within. */
export function catalogIndex(kind: "camera" | "lens"): { brand: string; name: string; items: (Camera | Lens)[] }[] {
  const pool: (Camera | Lens)[] = kind === "camera" ? publishedCameras() : publishedLenses();
  return brands()
    .map((b) => ({ brand: b.slug, name: b.name, items: pool.filter((p) => p.brand === b.slug).sort((x, y) => x.shortName.localeCompare(y.shortName, "en", { numeric: true })) }))
    .filter((g) => g.items.length)
    .sort((a, b) => a.name.localeCompare(b.name));
}
