// How each spec is labelled, grouped, formatted and compared. The compare
// page walks SPEC_GROUPS in order; a row whose values all match can be hidden
// with "differences only", and `better` decides which column gets the win
// marker. `better: null` means "different, not better" (a mount, a card type).
import type { Camera, Specs } from "../catalog/schema";

export type Better = "higher" | "lower" | null;

export type SpecDef<T = Camera> = {
  key: string;
  label: string;
  /** Number used to rank values when `better` is set; null = not comparable. */
  rank?: (c: T) => number | null;
  better: Better;
  format: (c: T) => string | null;
  /** One line shown under the label on the compare page. */
  help?: string;
  /** Only relevant to some products (waterproofing): hide the row when every value is empty. */
  optional?: boolean;
};

export type SpecGroup<T = Camera> = { id: string; title: string; specs: SpecDef<T>[] };

const SENSOR_LABEL: Record<Specs["sensorFormat"], string> = {
  "medium-format": "Medium format",
  "full-frame": "Full frame",
  "aps-h": "APS-H",
  "super-35": "Super 35",
  "aps-c": "APS-C",
  "micro-four-thirds": "Micro Four Thirds",
  "1.4-inch": '1.4"',
  "1-inch": '1"',
  "2/3-inch": '2/3"',
  "1/1.28-inch": '1/1.28"',
  "1/1.3-inch": '1/1.3"',
  "1/1.7-inch": '1/1.7"',
  "1/1.9-inch": '1/1.9"',
  "1/2-inch": '1/2"',
  "1/2.3-inch": '1/2.3"',
  "1/2.8-inch": '1/2.8"',
};

// Approximate sensor area in mm², for ranking only (never displayed).
const SENSOR_AREA: Record<Specs["sensorFormat"], number> = {
  "medium-format": 1452,
  "full-frame": 864,
  "aps-h": 548,
  "super-35": 362,
  "aps-c": 370,
  "micro-four-thirds": 225,
  "1.4-inch": 226, // Canon's 1.4-type: ~18.4 x 12.3 mm, a hair over Four Thirds by area
  "1-inch": 116,
  "2/3-inch": 58,
  "1/1.28-inch": 73,
  "1/1.3-inch": 69,
  "1/1.7-inch": 43,
  "1/1.9-inch": 36,
  "1/2-inch": 31,
  "1/2.3-inch": 28,
  "1/2.8-inch": 22,
};

export const sensorLabel = (f: Specs["sensorFormat"]) => SENSOR_LABEL[f];
export const sensorArea = (f: Specs["sensorFormat"]) => SENSOR_AREA[f];

const SCREEN_LABEL: Record<Specs["screenType"], string> = {
  "fully-articulating": "Fully articulating",
  tilting: "Tilting",
  "multi-angle": "Multi-angle (tilt + flip)",
  "flip-up": "Flip-up",
  fixed: "Fixed",
  none: "No rear screen",
};

const TYPE_LABEL: Record<Camera["type"], string> = {
  mirrorless: "Mirrorless",
  dslr: "DSLR",
  compact: "Compact (fixed lens)",
  "medium-format": "Medium format",
  rangefinder: "Rangefinder",
  action: "Action camera",
  "360": "360° camera",
  cinema: "Cinema camera",
};
export const typeLabel = (t: Camera["type"]) => TYPE_LABEL[t];

export const num = (v: number | null, unit = "", digits = 1) =>
  v === null ? null : `${Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(digits).replace(/\.0$/, "")}${unit}`;
export const yesNo = (v: boolean | null) => (v === null ? null : v ? "Yes" : "No");
export const yesRank = (v: boolean | null) => (v === null ? null : v ? 1 : 0);

/** "4K" → 3840, "6.2K" → 6200, "1080p" → 1920. For ranking only. */
export function videoWidth(res: string | null): number | null {
  if (!res) return null;
  if (res === "1080p") return 1920;
  if (res === "720p") return 1280;
  const k = Number(res.replace("K", ""));
  return k === 4 ? 3840 : Math.round(k * 1000);
}

export function lensLabel(c: Camera): string | null {
  if (!c.fixedLens) return null;
  const f = c.fixedLens.focalMm;
  const focal = f ? `${f.length === 1 ? `${f[0]}mm` : `${f[0]}–${f[1]}mm`} (35mm eq.)` : null;
  return [focal, c.fixedLens.aperture].filter(Boolean).join(" ") || "Fixed lens";
}

const s = <K extends keyof Specs>(k: K) => (c: Camera) => c.specs[k];

export const SPEC_GROUPS: SpecGroup<Camera>[] = [
  {
    id: "overview",
    title: "Overview",
    specs: [
      { key: "type", label: "Type", better: null, format: (c) => typeLabel(c.type) },
      { key: "announced", label: "Announced", better: "higher", rank: (c) => Date.parse(c.announced), format: (c) => new Date(c.announced + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) },
      { key: "launchPriceUsd", label: "US launch price", better: null, format: (c) => (c.launchPriceUsd === null ? null : `$${c.launchPriceUsd.toLocaleString("en-US")}`), help: "US list price when announced, body only. Today's prices are in the offers table." },
      { key: "lens", label: "Lens", better: null, format: (c) => lensLabel(c) ?? "Interchangeable" },
    ],
  },
  {
    id: "sensor",
    title: "Sensor & image",
    specs: [
      { key: "sensorFormat", label: "Sensor size", better: "higher", rank: (c) => SENSOR_AREA[c.specs.sensorFormat], format: (c) => SENSOR_LABEL[c.specs.sensorFormat] },
      { key: "sensorType", label: "Sensor type", better: null, format: s("sensorType") },
      { key: "megapixels", label: "Resolution", better: "higher", rank: s("megapixels"), format: (c) => num(c.specs.megapixels, " MP") },
      { key: "isoRange", label: "Native ISO", better: "higher", rank: s("isoMax"), format: (c) => (c.specs.isoMin && c.specs.isoMax ? `${c.specs.isoMin.toLocaleString("en-US")}–${c.specs.isoMax.toLocaleString("en-US")}` : null) },
      { key: "ibis", label: "In-body stabilisation", better: "higher", rank: (c) => (c.specs.ibis === null ? null : c.specs.ibis ? c.specs.ibisStops ?? 1 : 0), format: (c) => (c.specs.ibis === null ? null : c.specs.ibis ? (c.specs.ibisStops ? `Yes, ${num(c.specs.ibisStops)} stops` : "Yes") : "No") },
    ],
  },
  {
    id: "speed",
    title: "Speed & autofocus",
    specs: [
      { key: "burstMechFps", label: "Burst (mechanical)", better: "higher", rank: s("burstMechFps"), format: (c) => num(c.specs.burstMechFps, " fps") },
      { key: "burstElecFps", label: "Burst (electronic)", better: "higher", rank: s("burstElecFps"), format: (c) => num(c.specs.burstElecFps, " fps") },
      { key: "shutterMaxMech", label: "Fastest shutter (mech.)", better: "higher", rank: s("shutterMaxMech"), format: (c) => (c.specs.shutterMaxMech ? `1/${c.specs.shutterMaxMech.toLocaleString("en-US")}s` : null) },
      { key: "shutterMaxElec", label: "Fastest shutter (elec.)", better: "higher", rank: s("shutterMaxElec"), format: (c) => (c.specs.shutterMaxElec ? `1/${c.specs.shutterMaxElec.toLocaleString("en-US")}s` : null) },
      { key: "afPoints", label: "AF points", better: null, format: (c) => num(c.specs.afPoints), help: "Makers count points differently, so this is not ranked." },
      { key: "afSubjects", label: "Subject detection", better: "higher", rank: (c) => c.specs.afSubjects?.length ?? null, format: (c) => (c.specs.afSubjects === null ? null : c.specs.afSubjects.length ? c.specs.afSubjects.map((x) => x[0].toUpperCase() + x.slice(1)).join(", ") : "None") },
    ],
  },
  {
    id: "video",
    title: "Video",
    specs: [
      { key: "videoMaxRes", label: "Max resolution", better: "higher", rank: (c) => videoWidth(c.specs.videoMaxRes), format: s("videoMaxRes") },
      { key: "video4kMaxFps", label: "4K frame rate", better: "higher", rank: s("video4kMaxFps"), format: (c) => num(c.specs.video4kMaxFps, "p") },
      { key: "video10bit", label: "10-bit internal", better: "higher", rank: (c) => yesRank(c.specs.video10bit), format: (c) => yesNo(c.specs.video10bit) },
      { key: "rawVideoInternal", label: "Internal raw video", better: "higher", rank: (c) => yesRank(c.specs.rawVideoInternal), format: (c) => yesNo(c.specs.rawVideoInternal) },
      { key: "micJack", label: "Mic input", better: "higher", rank: (c) => yesRank(c.specs.micJack), format: (c) => yesNo(c.specs.micJack) },
      { key: "headphoneJack", label: "Headphone jack", better: "higher", rank: (c) => yesRank(c.specs.headphoneJack), format: (c) => yesNo(c.specs.headphoneJack) },
    ],
  },
  {
    id: "handling",
    title: "Viewfinder & screen",
    specs: [
      { key: "viewfinder", label: "Viewfinder", better: "higher", rank: (c) => (c.specs.viewfinderType === "none" ? 0 : c.specs.evfDotsM ?? 1), format: (c) => ({ electronic: c.specs.evfDotsM ? `Electronic, ${num(c.specs.evfDotsM, "M dots", 2)}` : "Electronic", optical: "Optical", hybrid: c.specs.evfDotsM ? `Hybrid optical/EVF, ${num(c.specs.evfDotsM, "M dots", 2)}` : "Hybrid optical/EVF", none: "None" })[c.specs.viewfinderType] },
      { key: "screen", label: "Rear screen", better: "higher", rank: s("screenDotsM"), format: (c) => (c.specs.screenType === "none" ? "None" : [c.specs.screenSizeIn ? `${c.specs.screenSizeIn}"` : null, c.specs.screenDotsM ? `${num(c.specs.screenDotsM, "M dots", 2)}` : null].filter(Boolean).join(", ") || null) },
      { key: "screenType", label: "Screen articulation", better: null, format: (c) => SCREEN_LABEL[c.specs.screenType] },
      { key: "touchscreen", label: "Touchscreen", better: "higher", rank: (c) => yesRank(c.specs.touchscreen), format: (c) => yesNo(c.specs.touchscreen) },
    ],
  },
  {
    id: "body",
    title: "Body & battery",
    specs: [
      { key: "weightG", label: "Weight (with battery)", better: "lower", rank: s("weightG"), format: (c) => num(c.specs.weightG, " g") },
      { key: "dimensionsMm", label: "Dimensions (W×H×D)", better: null, format: (c) => (c.specs.dimensionsMm ? `${c.specs.dimensionsMm.map((d) => d.toString()).join(" × ")} mm` : null) },
      { key: "weatherSealed", label: "Weather sealed", better: "higher", rank: (c) => yesRank(c.specs.weatherSealed), format: (c) => yesNo(c.specs.weatherSealed) },
      { key: "batteryShotsCipa", label: "Battery (CIPA shots)", better: "higher", rank: s("batteryShotsCipa"), format: (c) => num(c.specs.batteryShotsCipa) },
      { key: "waterproofM", label: "Waterproof", optional: true, better: "higher", rank: s("waterproofM"), format: (c) => (c.specs.waterproofM ? `${num(c.specs.waterproofM)} m` : null) },
      { key: "cardSlots", label: "Card slots", better: "higher", rank: s("cardSlots"), format: (c) => (c.specs.cardSlots === null ? null : [String(c.specs.cardSlots), c.specs.cardTypes].filter(Boolean).join(" · ")) },
      { key: "usbC", label: "USB-C", better: "higher", rank: (c) => yesRank(c.specs.usbC), format: (c) => yesNo(c.specs.usbC) },
      { key: "builtInFlash", label: "Built-in flash", better: null, format: (c) => yesNo(c.specs.builtInFlash) },
      { key: "wireless", label: "Wi-Fi / Bluetooth", better: null, format: (c) => (c.specs.wifi === null && c.specs.bluetooth === null ? null : [c.specs.wifi ? "Wi-Fi" : null, c.specs.bluetooth ? "Bluetooth" : null].filter(Boolean).join(" + ") || "None") },
    ],
  },
];

export type CompareCell = { text: string | null; win: boolean };
export type CompareRow<T = Camera> = { def: SpecDef<T>; cells: CompareCell[]; allSame: boolean };

/** One row per spec, with the winning column(s) marked. A tie marks nobody. */
export function compareRows<T>(cameras: T[], group: SpecGroup<T>): CompareRow<T>[] {
  return group.specs.map((def) => {
    const texts = cameras.map((c) => def.format(c));
    const allSame = texts.every((t) => t === texts[0]);
    let wins = cameras.map(() => false);
    if (def.better && def.rank && cameras.length > 1 && !allSame) {
      const ranks = cameras.map((c) => def.rank!(c));
      const known = ranks.filter((r): r is number => r !== null);
      if (known.length >= 2) {
        const best = def.better === "higher" ? Math.max(...known) : Math.min(...known);
        const nBest = known.filter((r) => r === best).length;
        if (nBest < known.length) wins = ranks.map((r) => r === best);
      }
    }
    return { def, cells: texts.map((text, i) => ({ text, win: wins[i] })), allSame };
  });
}

/**
 * Plain-language differences between two cameras, strongest first, built
 * only from rows where both values are known and one is clearly better.
 * Facts, not opinions: no "winner" is declared.
 */
export function keyDifferences<T extends { shortName: string }>(a: T, b: T, groups: SpecGroup<T>[], limit = 6): string[] {
  const out: string[] = [];
  for (const g of groups) {
    for (const row of compareRows([a, b], g)) {
      const [x, y] = row.cells;
      if (!x.text || !y.text || x.win === y.win) continue;
      const [w, l, wt, lt] = x.win ? [a, b, x.text, y.text] : [b, a, y.text, x.text];
      out.push(`${row.def.label}: ${wt} on the ${w.shortName}, against ${lt} on the ${l.shortName}.`);
    }
  }
  return out.slice(0, limit);
}
