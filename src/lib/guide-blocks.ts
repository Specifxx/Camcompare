// Live blocks inside guides and blog posts. A post never types a price or a
// spec: a line of its own like `[[picks:sony-a7-v,nikon-z5-ii]]` is replaced
// at build with today's prices and the catalog's specs (GuideBody). Prices
// rebuild with every price commit, so a post is as fresh as the product pages.
//
//   [[picks:slug,slug,...]]                     a card per product: specs, best new price + store, used, other markets
//   [[top:type=mirrorless,sensor=full-frame,max=2000,min=0,since=2023,sort=price,n=8]]
//                                               the same cards, chosen from the catalog by today's US new price
//   [[specs:slug,slug,...|key+key+...]]         a spec table from the maker's sheets (keys from SPEC_GROUPS)
//   [[deals:n=8]]                               today's biggest US bargains against the launch RRP (DealsView rules)
//   {{price:slug}}  {{used:slug}}  {{count:drone}}   inline
//
// A product nobody prices yet (or not yet published) still shows its specs,
// never a guessed price; a block with nothing to show renders nothing.
import { displayName, offersFor, product, publishedCameras } from "./catalog";
import { readCameraFiles } from "./catalog/load";
import type { Camera } from "./catalog/schema";
import { price } from "./format";
import { MARKETS, type MarketCode } from "./markets";
import { lowest, type Offer } from "./offers";
import { SPEC_GROUPS, type SpecDef } from "./specs/definitions";

export const HOME: MarketCode = "us";
/** The other markets a pick card lists under its US price, each in its own currency. */
export const ABROAD: MarketCode[] = ["uk", "eu", "au", "sg"];

export type Segment = { md: string } | { block: string; arg: string };

/** Markdown and block lines, in order. A block is a whole line `[[kind:args]]`. */
export function segments(body: string): Segment[] {
  const parts = body.split(/^\[\[(\w+):([^\]\n]*)\]\]\s*$/m);
  const out: Segment[] = [];
  for (let i = 0; i < parts.length; i += 3) {
    if (parts[i].trim()) out.push({ md: parts[i] });
    if (parts[i + 1]) out.push({ block: parts[i + 1], arg: parts[i + 2] });
  }
  return out;
}

let all: Map<string, Camera> | null = null;
/** Every camera in the catalog, published or not: a drone still waiting for its photo keeps its spec row. */
export function anyCamera(slug: string): Camera | null {
  all ??= new Map(readCameraFiles().cameras.map((c) => [c.slug, c]));
  return all.get(slug) ?? null;
}

export type MarketPrice = { market: MarketCode; new: Offer | null; used: Offer | null };
export type PickRow = { slug: string; name: string; published: boolean; camera: Camera; home: MarketPrice; abroad: MarketPrice[] };

const priceIn = (slug: string, m: MarketCode): MarketPrice => {
  const o = offersFor(slug, m);
  return { market: m, new: lowest(o, "new"), used: lowest(o, "used") };
};

export function pickRow(slug: string): PickRow | null {
  const camera = anyCamera(slug);
  if (!camera) return null;
  const published = Boolean(product(slug));
  return {
    slug,
    name: published ? displayName(camera, HOME) : camera.name,
    published,
    camera,
    home: priceIn(slug, HOME),
    abroad: ABROAD.map((m) => priceIn(slug, m)).filter((p) => p.new || p.used),
  };
}

/** `a=1,b=x+y` → { a: "1", b: "x+y" }. */
export function args(arg: string): Record<string, string> {
  return Object.fromEntries(
    arg
      .split(",")
      .map((kv) => kv.split("=").map((s) => s.trim()))
      .filter((kv) => kv.length === 2 && kv[0]),
  );
}

/**
 * Published cameras with a US new price today, filtered and ranked:
 * type (one or several, "+"), sensor, max/min (whole dollars), since (year announced).
 * sort=price (cheapest first, the default) or newest.
 */
export function topSlugs(arg: string): string[] {
  const o = args(arg);
  const types = o.type?.split("+");
  const sensors = o.sensor?.split("+");
  const rows = publishedCameras()
    .filter((c) => (!types || types.includes(c.type)) && (!sensors || (c.specs.sensorFormat !== null && sensors.includes(c.specs.sensorFormat))) && (!o.since || c.announced.slice(0, 4) >= o.since))
    .map((c) => ({ c, p: lowest(offersFor(c.slug, HOME), "new")?.price ?? null }))
    .filter((x): x is { c: Camera; p: number } => x.p !== null && (!o.max || x.p <= Number(o.max) * 100) && (!o.min || x.p >= Number(o.min) * 100));
  rows.sort(o.sort === "newest" ? (a, b) => b.c.announced.localeCompare(a.c.announced) || a.p - b.p : (a, b) => a.p - b.p || b.c.announced.localeCompare(a.c.announced));
  return rows.slice(0, Number(o.n ?? 8)).map((x) => x.c.slug);
}

const DEFS = new Map(SPEC_GROUPS.flatMap((g) => g.specs).map((d) => [d.key, d] as const));
export const DRONE_SPECS = ["sensorFormat", "megapixels", "video4kMaxFps", "flightTimeMin", "obstacleSensing", "weightG"];
export const CAMERA_SPECS = ["sensorFormat", "megapixels", "ibis", "video4kMaxFps", "weightG", "weatherSealed"];

/** The spec definitions a table shows: the post's own list, else the drone or camera default. */
export function specDefs(keys: string[] | undefined, cams: Camera[]): SpecDef[] {
  const k = keys?.length ? keys : cams.every((c) => c.type === "drone") ? DRONE_SPECS : CAMERA_SPECS;
  return k.map((x) => DEFS.get(x)).filter((d): d is SpecDef => Boolean(d));
}

/** Inline tokens: today's US new or used price, or a catalog count. Never a guess: an unpriced product says so. */
export function inline(md: string): string {
  return md
    .replace(/\{\{count:([a-z0-9+-]+)\}\}/g, (_, t: string) => String(publishedCameras().filter((c) => t.split("+").includes(c.type)).length))
    .replace(/\{\{(price|used):([a-z0-9-]+)\}\}/g, (_, kind: string, slug: string) => {
      const p = priceIn(slug, HOME);
      const o = kind === "price" ? p.new : p.used;
      return o ? price(o.price, MARKETS[HOME].currency) : kind === "price" ? "not priced new in the US today" : "no used price in the US today";
    });
}

/** The products a post is about, in order: its hero, then every pick, spec row and top-list entry. */
export function postSlugs(g: { hero?: string; body: string }): string[] {
  const out: string[] = g.hero ? [g.hero] : [];
  for (const s of segments(g.body)) {
    if (!("block" in s)) continue;
    if (s.block === "picks" || s.block === "specs") out.push(...s.arg.split("|")[0].split(",").map((x) => x.trim()));
    if (s.block === "top") out.push(...topSlugs(s.arg));
  }
  return [...new Set(out)].filter((x) => anyCamera(x));
}
