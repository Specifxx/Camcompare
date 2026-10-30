// Two hand-picked camera pages built from the catalog and today's offers,
// with no data source of their own beyond one small committed file:
//  - /digicams: every compact ("digicam") camera in the catalog, grouped by
//    sensor size, plus the older ones that still trade used.
//  - /viral-cameras: the owner's list in data/viral.json (slug + one line why).
// Server-only (reads data/ at build time, like every page).
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { camera, offersFor, publishedCameras } from "./catalog";
import type { Camera } from "./catalog/schema";
import type { MarketCode } from "./markets";
import { isAmazonOffer, lowest, type Offer } from "./offers";

export const VIRAL_FILE = path.join(process.cwd(), "data", "viral.json");

export const viralFileSchema = z
  .object({
    note: z.string().optional(),
    updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    cameras: z.array(z.object({ slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/), why: z.string().min(10).max(200) }).strict()).min(1),
  })
  .strict();
export type ViralFile = z.infer<typeof viralFileSchema>;

export function readViral(file = VIRAL_FILE): ViralFile {
  return viralFileSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
}

/** The viral list's cameras that are published, in the file's order, once each. */
export function viralCameras(file = VIRAL_FILE): { camera: Camera; why: string }[] {
  const seen = new Set<string>();
  const out: { camera: Camera; why: string }[] = [];
  for (const e of readViral(file).cameras) {
    const c = camera(e.slug);
    if (!c || seen.has(e.slug)) continue;
    seen.add(e.slug);
    out.push({ camera: c, why: e.why });
  }
  return out;
}

export type Availability = { inStock: number; backorder: string[]; preorder: string[]; listed: number; note: string | null };

/**
 * Stock across a product's offers in one market (Amazon left out, as in every
 * stored or static figure): stores with it in stock, and the stores whose
 * listing says backorder or pre-order. `note` is the plain line to show.
 */
export function availabilityOf(offers: Offer[], retailerName: (id: string) => string = (id) => id): Availability {
  const own = offers.filter((o) => !isAmazonOffer(o) && !o.kit);
  const stores = (f: (o: Offer) => boolean) => [...new Set(own.filter(f).map((o) => retailerName(o.retailer)))].sort();
  const inStock = new Set(own.filter((o) => o.inStock && o.availability !== "backorder" && o.availability !== "preorder").map((o) => o.retailer)).size;
  const backorder = stores((o) => o.availability === "backorder");
  const preorder = stores((o) => o.availability === "preorder");
  const listed = new Set(own.map((o) => o.retailer)).size;
  const parts: string[] = [];
  if (backorder.length) parts.push(`Backordered at ${backorder.join(", ")}`);
  if (preorder.length) parts.push(`Pre-order at ${preorder.join(", ")}`);
  if (!inStock && listed && !parts.length) parts.push(listed === 1 ? "Out of stock at the one store we track" : `Out of stock at all ${listed} stores we track`);
  if (!listed) parts.push("No store we track lists it in this market yet");
  return { inStock, backorder, preorder, listed, note: parts.length ? parts.join(" · ") : null };
}

// ---------------------------------------------------------------- digicams

export const DIGICAM_GROUPS = [
  { id: "large", title: "Large-sensor compacts", blurb: "APS-C, full-frame and Micro Four Thirds sensors in a fixed-lens body: the Ricoh GR, Fujifilm X100 and Leica Q kind.", formats: ["full-frame", "aps-c", "micro-four-thirds", "1.4-inch"] },
  { id: "one-inch", title: "1-inch pocket cameras", blurb: "The classic premium digicam: Sony RX100, Canon G7 X, Sony ZV-1 and pocket gimbals.", formats: ["1-inch"] },
  { id: "small", title: "Travel zooms, tough and bridge cameras", blurb: "Smaller sensors and long zooms: waterproof cameras, superzooms and the everyday point-and-shoot.", formats: [] as string[] },
] as const;

/** A digicam announced before this year counts as an "older" pick (bought used, often for its look). */
export const DIGICAM_OLD_BEFORE = 2019;

export function digicams(): Camera[] {
  return publishedCameras()
    .filter((c) => c.type === "compact")
    .sort((a, b) => b.announced.localeCompare(a.announced) || a.name.localeCompare(b.name));
}

export function digicamGroups(): { id: string; title: string; blurb: string; cameras: Camera[] }[] {
  const all = digicams();
  const named = new Set<string>(DIGICAM_GROUPS.flatMap((g) => [...g.formats]));
  return DIGICAM_GROUPS.map((g) => ({
    id: g.id,
    title: g.title,
    blurb: g.blurb,
    cameras: all.filter((c) => (g.formats.length ? (g.formats as readonly string[]).includes(c.specs.sensorFormat ?? "") : !named.has(c.specs.sensorFormat ?? ""))),
  }));
}

/** Older digicams with a used price in this market, cheapest used first. */
export function olderDigicams(m: MarketCode): { camera: Camera; used: number }[] {
  return digicams()
    .filter((c) => Number(c.announced.slice(0, 4)) < DIGICAM_OLD_BEFORE)
    .map((c) => ({ camera: c, used: lowest(offersFor(c.slug, m), "used")?.price ?? null }))
    .filter((x): x is { camera: Camera; used: number } => x.used !== null)
    .sort((a, b) => a.used - b.used);
}

/** A curated page's market version is worth indexing once that market prices any of its cameras (the US always). */
export const pricedIn = (cams: Camera[], m: MarketCode) => m === "us" || cams.some((c) => offersFor(c.slug, m).length > 0);

// ---------------------------------------------------------------- drones and camera glasses

/**
 * /drones and /smart-glasses: every camera of that type in the catalog,
 * grouped, with today's prices. They are cameras in the catalog (type
 * "drone" / "smart-glasses", priced and matched like any other), and these
 * pages are their front door.
 */
export const GADGET_PAGES = {
  drone: {
    path: "/drones",
    label: "Drones",
    groups: [
      { id: "under-250", title: "Under 250 g", blurb: "Mini drones under the 250 g line that many countries use for lighter rules: DJI Mini, Flip and Neo. Check your own country's rules before you fly.", test: (c: Camera) => c.specs.weightG !== null && c.specs.weightG < 250 },
      { id: "over-250", title: "250 g and over", blurb: "Bigger sensors, longer flights and more wind resistance: DJI Air, Mavic and FPV drones. Most countries ask you to register a drone this heavy.", test: (c: Camera) => c.specs.weightG === null || c.specs.weightG >= 250 },
    ],
  },
  "smart-glasses": {
    path: "/smart-glasses",
    label: "Smart glasses",
    groups: [{ id: "camera-glasses", title: "Camera glasses", blurb: "Glasses with a camera in the frame for hands-free photos and point-of-view video, plus open-ear audio and an assistant.", test: () => true }],
  },
} as const;
export type GadgetType = keyof typeof GADGET_PAGES;

/** The curated page a drone or camera glasses belongs to, or null for any other camera. */
export const gadgetPage = (t: Camera["type"]) => (t === "drone" || t === "smart-glasses" ? GADGET_PAGES[t] : null);

export function gadgets(t: GadgetType): Camera[] {
  return publishedCameras()
    .filter((c) => c.type === t)
    .sort((a, b) => b.announced.localeCompare(a.announced) || a.name.localeCompare(b.name));
}

export function gadgetGroups(t: GadgetType): { id: string; title: string; blurb: string; cameras: Camera[] }[] {
  const all = gadgets(t);
  return GADGET_PAGES[t].groups.map((g) => ({ id: g.id, title: g.title, blurb: g.blurb, cameras: all.filter((c) => g.test(c)) })).filter((g) => g.cameras.length > 0);
}
