// Camera hubs by type and by sensor size: /cameras/type/<type> and /cameras/sensor/<sensor> (SEO-9, 2026-11-10).
// "Mirrorless cameras", "full-frame cameras" and "action cameras" are searches with buyers behind them; until now
// they existed only as filter states (/cameras?type=…) that Google folds into one page. Every number on a hub
// comes from the day's offers; the list is every camera priced in the market, cheapest first, no paid placement.
// Server-only (reads the catalog); no component imports, so node tests and the sitemap can load it.
import { publishedCameras } from "@/lib/catalog";
import type { Camera } from "@/lib/catalog/schema";
import { price } from "@/lib/format";
import { MARKETS, type MarketCode } from "@/lib/markets";
import { summarizeCamera } from "@/lib/summary";
import { priceOf, type CameraSummary } from "@/lib/summary-types";

export type HubKind = "type" | "sensor";
export type Hub = { kind: HubKind; key: string; label: string; /** "mirrorless cameras" */ noun: string; blurb: string };

export const TYPE_HUBS: Hub[] = [
  { kind: "type", key: "mirrorless", label: "Mirrorless", noun: "mirrorless cameras", blurb: "Interchangeable-lens cameras with no mirror box: the type most new systems are built on." },
  { kind: "type", key: "dslr", label: "DSLR", noun: "DSLR cameras", blurb: "Interchangeable-lens cameras with an optical viewfinder, still sold new and common second-hand." },
  { kind: "type", key: "medium-format", label: "Medium format", noun: "medium-format cameras", blurb: "Cameras with a sensor larger than full frame, for studio, landscape and high-resolution work." },
  { kind: "type", key: "rangefinder", label: "Rangefinder", noun: "rangefinder cameras", blurb: "Compact interchangeable-lens cameras focused through a rangefinder or its digital equivalent." },
  { kind: "type", key: "action", label: "Action", noun: "action cameras", blurb: "Small, waterproof, wide-angle cameras for sport, travel and point-of-view video." },
  { kind: "type", key: "360", label: "360°", noun: "360° cameras", blurb: "Cameras that capture everything around them at once, for virtual tours and reframed video." },
  { kind: "type", key: "cinema", label: "Cinema", noun: "cinema cameras", blurb: "Video-first cameras with pro codecs, connectivity and rigging points." },
];
export const SENSOR_HUBS: Hub[] = [
  { kind: "sensor", key: "full-frame", label: "Full frame", noun: "full-frame cameras", blurb: "Cameras with a 36 × 24 mm sensor: the most light and shallowest depth of field in a normal-sized body." },
  { kind: "sensor", key: "aps-c", label: "APS-C", noun: "APS-C cameras", blurb: "Cameras with a sensor about 1.5 times smaller across than full frame: smaller, lighter and cheaper lenses." },
  { kind: "sensor", key: "micro-four-thirds", label: "Micro Four Thirds", noun: "Micro Four Thirds cameras", blurb: "Cameras with a 17.3 × 13 mm sensor: compact bodies and lenses, strong stabilisation." },
  { kind: "sensor", key: "medium-format", label: "Medium format", noun: "medium-format cameras", blurb: "Cameras with a sensor larger than full frame, for studio, landscape and high-resolution work." },
];

export const HUB_INDEX_MIN = 3;
export const hubsOf = (kind: HubKind) => (kind === "type" ? TYPE_HUBS : SENSOR_HUBS);
export const hubFor = (kind: HubKind, key: string): Hub | undefined => hubsOf(kind).find((h) => h.key === key);
export const hubPath = (h: Hub) => `/cameras/${h.kind}/${h.key}`;

/** The same grouping as the filter on /cameras (components/Browser.tsx sensorGroup), so a hub lists what the filter would. */
const sensorGroup = (s: Camera["specs"]["sensorFormat"]) =>
  s === null ? "small" : s === "four-thirds" ? "micro-four-thirds" : s === "super-35" ? "aps-c" : s === "aps-h" ? "full-frame" : ["medium-format", "full-frame", "aps-c", "micro-four-thirds"].includes(s) ? s : "small";

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

export type HubData = { cameras: CameraSummary[]; withNew: number; cheapest: CameraSummary | null; medianNew: number | null; brands: number };

/** Every camera of the hub priced in the market (new, or used where no store has it new), cheapest first. */
export function hubData(h: Hub, m: MarketCode): HubData {
  const cams = publishedCameras()
    .filter((c) => (h.kind === "type" ? c.type === h.key : sensorGroup(c.specs.sensorFormat) === h.key))
    .map((c) => summarizeCamera(c, m))
    .filter((c) => c.lowestNew !== null || c.lowestUsed !== null)
    .sort((a, b) => (priceOf(a) ?? Infinity) - (priceOf(b) ?? Infinity) || b.announced.localeCompare(a.announced));
  const news = cams.map((c) => c.lowestNew).filter((x): x is number => x !== null);
  const cheapest = cams.find((c) => c.lowestNew !== null) ?? null;
  return { cameras: cams, withNew: news.length, cheapest, medianNew: news.length ? median(news) : null, brands: new Set(cams.map((c) => c.brand)).size };
}

export const hubIndexable = (h: Hub, m: MarketCode) => hubData(h, m).cameras.length >= HUB_INDEX_MIN;
/** Hubs a market lists (the navigation, the sitemap, hreflang). */
export const liveHubs = (kind: HubKind, m: MarketCode) => hubsOf(kind).filter((h) => hubIndexable(h, m));

/** The intro's facts as a sentence, only from the data: how many, from what, the middle of the range. */
export function hubFacts(h: Hub, d: HubData, m: MarketCode): string {
  const cur = MARKETS[m].currency;
  const parts = [`We track ${d.cameras.length} ${h.noun} with a price at stores in ${MARKETS[m].name}, from ${d.brands} ${d.brands === 1 ? "maker" : "makers"}.`];
  if (d.cheapest && d.cheapest.lowestNew !== null) parts.push(`The cheapest new one today is the ${d.cheapest.name} at ${price(d.cheapest.lowestNew, cur)}${d.medianNew !== null && d.withNew > 2 ? `, and the middle of the range is ${price(d.medianNew, cur)}` : ""}.`);
  else parts.push("None has a new price today; the prices below are used and refurbished.");
  return parts.join(" ");
}
