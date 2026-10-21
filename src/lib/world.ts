// The global price comparison (/world, /world/<brand>, /world/<brand>/<line>):
// one table per product line, like the "G Master global price comparison"
// posts buyers share. Each product's US list price (the catalog's launch USD)
// against today's lowest new price in every market we price, converted into
// one currency the visitor picks, labelled "≈ at today's exchange rate".
// The second and last place a converted price may appear (after the product
// page's "Price around the world"; DECISIONS "Global price comparison page").
//
// Japan and Hong Kong are not markets yet: WORLD_COLUMNS lists them with
// `live: false`, so the table grows a column the day a market (and its
// currency) exists, with no change here beyond flipping the flag.
import { brandName, displayName, offersFor, publishedCameras, publishedLenses } from "./catalog";
import type { Camera, Lens } from "./catalog/schema";
import { readFx } from "./fx";
import { liveColumns, type WorldCell, type WorldRow, type WorldTableData } from "./world-table";
import { lowest } from "./offers";
import { retailer } from "./retailers";

export * from "./world-table";

export type WorldLine = {
  brand: string;
  slug: string;
  name: string; // "G Master lenses"
  blurb: string;
  kind: "camera" | "lens";
  match: (p: Camera | Lens) => boolean;
};

const lensOf = (p: Camera | Lens): Lens | null => ("coverage" in p ? (p as Lens) : null);
const camOf = (p: Camera | Lens): Camera | null => ("type" in p ? (p as Camera) : null);
const mount = (p: Camera | Lens, m: string) => (lensOf(p)?.mounts ?? []).includes(m);
const ACTION = (p: Camera | Lens) => ["action", "360", "compact"].includes(camOf(p)?.type ?? "");

export const WORLD_LINES: WorldLine[] = [
  { brand: "sony", slug: "g-master", name: "G Master lenses", blurb: "Sony's top full-frame E-mount lenses (GM).", kind: "lens", match: (p) => mount(p, "sony-e") && /\bGM\b/.test(p.name) },
  { brand: "sony", slug: "g", name: "G lenses", blurb: "Sony's G-series E-mount lenses, under the G Masters.", kind: "lens", match: (p) => mount(p, "sony-e") && /\bG\b/.test(p.name) && !/\bGM\b/.test(p.name) },
  { brand: "sony", slug: "alpha", name: "Alpha mirrorless cameras", blurb: "Sony's E-mount bodies, body only.", kind: "camera", match: (p) => camOf(p)?.type === "mirrorless" },
  { brand: "canon", slug: "l", name: "RF L lenses", blurb: "Canon's red-ring L lenses for the RF mount.", kind: "lens", match: (p) => mount(p, "canon-rf") && /F[\d.]+(?:-[\d.]+)?L\b/.test(p.name) },
  { brand: "canon", slug: "rf", name: "RF lenses (non-L)", blurb: "Canon's other RF and RF-S lenses.", kind: "lens", match: (p) => mount(p, "canon-rf") && !/F[\d.]+(?:-[\d.]+)?L\b/.test(p.name) },
  { brand: "canon", slug: "eos-r", name: "EOS R mirrorless cameras", blurb: "Canon's RF-mount bodies, body only.", kind: "camera", match: (p) => camOf(p)?.type === "mirrorless" },
  { brand: "nikon", slug: "s-line", name: "Z S-Line lenses", blurb: "Nikon's premium Z-mount lenses (the S after the name).", kind: "lens", match: (p) => mount(p, "nikon-z") && /\bS\b/.test(p.name) },
  { brand: "nikon", slug: "z", name: "Z mirrorless cameras", blurb: "Nikon's Z-mount bodies, body only.", kind: "camera", match: (p) => camOf(p)?.type === "mirrorless" },
  { brand: "fujifilm", slug: "gf", name: "GF lenses", blurb: "Fujifilm's medium-format G-mount lenses for GFX.", kind: "lens", match: (p) => mount(p, "fujifilm-g") },
  { brand: "fujifilm", slug: "gfx", name: "GFX cameras", blurb: "Fujifilm's medium-format bodies.", kind: "camera", match: (p) => camOf(p)?.type === "medium-format" },
  { brand: "fujifilm", slug: "xf", name: "XF and XC lenses", blurb: "Fujifilm's X-mount lenses.", kind: "lens", match: (p) => mount(p, "fujifilm-x") },
  { brand: "fujifilm", slug: "x", name: "X Series cameras", blurb: "Fujifilm's X-mount bodies, body only.", kind: "camera", match: (p) => camOf(p)?.type === "mirrorless" },
  { brand: "panasonic", slug: "lumix-s", name: "Lumix S lenses", blurb: "Panasonic's full-frame L-mount lenses.", kind: "lens", match: (p) => mount(p, "l-mount") },
  { brand: "panasonic", slug: "lumix", name: "Lumix mirrorless cameras", blurb: "Panasonic's L-mount and Micro Four Thirds bodies.", kind: "camera", match: (p) => camOf(p)?.type === "mirrorless" },
  // Action and pocket cameras: DJI's are hard to buy in the US, so the prices abroad matter more.
  { brand: "dji", slug: "osmo", name: "Osmo action and pocket cameras", blurb: "DJI's action, 360 and pocket gimbal cameras. DJI gear is hard to buy in the US, so prices abroad are worth knowing.", kind: "camera", match: ACTION },
  { brand: "gopro", slug: "hero", name: "HERO and MAX cameras", blurb: "GoPro's action and 360 cameras.", kind: "camera", match: ACTION },
  { brand: "insta360", slug: "cameras", name: "360 and action cameras", blurb: "Insta360's 360, action and thumb cameras.", kind: "camera", match: ACTION },
];

export const worldLine = (brand: string, line: string) => WORLD_LINES.find((l) => l.brand === brand && l.slug === line) ?? null;
export const worldBrands = () => [...new Set(WORLD_LINES.map((l) => l.brand))];
export const worldLinesOf = (brand: string) => WORLD_LINES.filter((l) => l.brand === brand);

/** Lowest in-stock new body price per market (Amazon, kits and used left out), as the product page counts it. */
export function worldTable(line: WorldLine): WorldTableData {
  const items: (Camera | Lens)[] = line.kind === "lens" ? publishedLenses() : publishedCameras();
  const rows: WorldRow[] = items
    .filter((p) => p.brand === line.brand && line.match(p))
    .map((p) => {
      const cells: Record<string, WorldCell> = {};
      for (const c of liveColumns()) {
        const o = lowest(offersFor(p.slug, c.market!), "new");
        cells[c.key] = o ? { price: o.price, currency: o.currency, store: retailer(o.retailer)?.name ?? o.retailer } : null;
      }
      return { slug: p.slug, path: `/${line.kind === "lens" ? "lenses" : "cameras"}/${p.slug}`, name: displayName(p, "us"), listUsd: p.launchPriceUsd, cells };
    })
    .sort((a, b) => {
      const pa = items.find((x) => x.slug === a.slug)!;
      const pb = items.find((x) => x.slug === b.slug)!;
      const la = lensOf(pa);
      const lb = lensOf(pb);
      if (la && lb) return la.specs.focalMinMm - lb.specs.focalMinMm || la.specs.focalMaxMm - lb.specs.focalMaxMm || a.name.localeCompare(b.name);
      return pb.announced.localeCompare(pa.announced) || a.name.localeCompare(b.name);
    });
  return { line: { brand: line.brand, slug: line.slug, name: line.name, blurb: line.blurb }, rows, priced: rows.filter((r) => Object.values(r.cells).some(Boolean)).length };
}

/** Units of each currency per US dollar, and their date (for the label). */
export function worldFx(): { date: string | null; rates: Record<string, number> } {
  const fx = readFx();
  return { date: fx.date, rates: { ...fx.rates } };
}

export const worldBrandName = (b: string) => brandName(b);
