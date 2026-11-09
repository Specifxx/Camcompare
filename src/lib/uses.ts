// The camera finder's picks for a use in a market, shared by /cameras-for/<use> (components/curated/UseView.tsx) and the
// navigation (lib/nav-data.ts). Server-only (reads the catalog); no component imports, so node tests can load it.
import { publishedCameras } from "@/lib/catalog";
import { recommend, USES, type Use } from "@/lib/finder";
import type { MarketCode } from "@/lib/markets";
import { summarizeCamera } from "@/lib/summary";
import { priceOf, type CameraSummary } from "@/lib/summary-types";

export const USE_KEYS = Object.keys(USES) as Use[];
export const USE_INDEX_MIN = 3;
const TOP = 12;
const LIGHT = 6;

const priced = (c: CameraSummary) => c.lowestNew !== null || c.lowestUsed !== null;

export function picksForUse(use: Use, m: MarketCode) {
  const cams = publishedCameras()
    .filter((c) => c.status === "current" || c.announced >= "2019")
    .map((c) => summarizeCamera(c, m))
    .filter(priced);
  const top = recommend(cams, use, "any", null, priceOf).slice(0, TOP);
  const shown = new Set(top.map((x) => x.c.slug));
  const light = recommend(cams, use, "small", null, priceOf)
    .filter((x) => !shown.has(x.c.slug))
    .slice(0, LIGHT);
  return { top, light };
}

