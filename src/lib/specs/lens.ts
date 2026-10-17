// Lens spec rows, in the same shape as the camera rows (definitions.ts), so
// the compare table, key differences and spec sheet work for both.
import type { Lens, LensCoverage } from "../catalog/schema";
import { num, yesNo, yesRank, type SpecGroup } from "./definitions";

const COVERAGE_LABEL: Record<LensCoverage, string> = {
  "medium-format": "Medium format",
  "full-frame": "Full frame",
  "aps-c": "APS-C",
  "micro-four-thirds": "Micro Four Thirds",
};
export const coverageLabel = (c: LensCoverage) => COVERAGE_LABEL[c];

// Crop factor to a 35mm-equivalent focal length. Canon APS-C is 1.6.
export function cropFactor(l: Pick<Lens, "coverage" | "brand" | "mounts">): number {
  if (l.coverage === "full-frame") return 1;
  if (l.coverage === "micro-four-thirds") return 2;
  if (l.coverage === "medium-format") return 0.79;
  return l.mounts.every((m) => m.startsWith("canon")) ? 1.6 : 1.5;
}

export const isZoom = (l: Lens) => l.specs.focalMaxMm > l.specs.focalMinMm;

export const fNumber = (n: number) => `f/${n}`;

export function focalLabel(l: Lens): string {
  const { focalMinMm: a, focalMaxMm: b } = l.specs;
  return a === b ? `${a}mm` : `${a}–${b}mm`;
}

export function apertureLabel(l: Lens): string {
  const { apertureMax: w, apertureMaxTele: t } = l.specs;
  return t ? `f/${w}–${t}` : fNumber(w);
}

/** "24–70mm (36–105mm equivalent on APS-C)" style, only when it isn't full frame. */
export function equivalentLabel(l: Lens): string | null {
  const k = cropFactor(l);
  if (k === 1) return null;
  const r = (x: number) => Math.round(x * k);
  const { focalMinMm: a, focalMaxMm: b } = l.specs;
  return a === b ? `${r(a)}mm equivalent` : `${r(a)}–${r(b)}mm equivalent`;
}

export type LensCategory = "ultra-wide" | "wide" | "standard" | "telephoto" | "super-telephoto" | "macro";

/** What a buyer would call it, from the 35mm-equivalent range. Macro wins when it reaches 1:2 or closer. */
export function lensCategories(l: Lens): LensCategory[] {
  const k = cropFactor(l);
  const lo = l.specs.focalMinMm * k;
  const hi = l.specs.focalMaxMm * k;
  const out = new Set<LensCategory>();
  if ((l.specs.maxMagnification ?? 0) >= 0.5) out.add("macro");
  if (lo < 20) out.add("ultra-wide");
  if (lo < 35 && hi >= 20) out.add("wide");
  if (lo <= 70 && hi >= 35) out.add("standard");
  if (hi > 70 && lo < 300) out.add("telephoto");
  if (hi >= 300) out.add("super-telephoto");
  return [...out];
}

export const CATEGORY_LABEL: Record<LensCategory, string> = {
  "ultra-wide": "Ultra-wide",
  wide: "Wide",
  standard: "Standard",
  telephoto: "Telephoto",
  "super-telephoto": "Super-telephoto",
  macro: "Macro",
};

const s = <K extends keyof Lens["specs"]>(k: K) => (l: Lens) => l.specs[k] as number | null;

export const LENS_SPEC_GROUPS: SpecGroup<Lens>[] = [
  {
    id: "optics",
    title: "Optics",
    specs: [
      { key: "focal", label: "Focal length", better: null, format: (l) => focalLabel(l) },
      { key: "equivalent", label: "35mm equivalent", better: null, format: (l) => equivalentLabel(l) ?? `${focalLabel(l)} (full frame)` },
      { key: "aperture", label: "Maximum aperture", better: "lower", rank: (l) => l.specs.apertureMax, format: (l) => apertureLabel(l), help: "Lower f-number lets in more light." },
      { key: "apertureMin", label: "Minimum aperture", better: null, format: (l) => (l.specs.apertureMin ? fNumber(l.specs.apertureMin) : null) },
      { key: "coverage", label: "Made for", better: null, format: (l) => COVERAGE_LABEL[l.coverage] },
      { key: "optics", label: "Elements / groups", better: null, format: (l) => (l.specs.elements && l.specs.groups ? `${l.specs.elements} / ${l.specs.groups}` : null) },
      { key: "apertureBlades", label: "Aperture blades", better: "higher", rank: s("apertureBlades"), format: (l) => num(l.specs.apertureBlades) },
      { key: "minFocusM", label: "Closest focus", better: "lower", rank: s("minFocusM"), format: (l) => (l.specs.minFocusM ? `${num(l.specs.minFocusM, " m", 2)}` : null) },
      { key: "maxMagnification", label: "Max magnification", better: "higher", rank: s("maxMagnification"), format: (l) => (l.specs.maxMagnification ? `${num(l.specs.maxMagnification, "×", 2)}` : null) },
    ],
  },
  {
    id: "handling",
    title: "Focus & handling",
    specs: [
      { key: "autofocus", label: "Autofocus", better: "higher", rank: (l) => yesRank(l.specs.autofocus), format: (l) => (l.specs.autofocus ? l.specs.afMotor ? `Yes (${l.specs.afMotor})` : "Yes" : "Manual focus") },
      { key: "stabilized", label: "Optical stabilisation", better: "higher", rank: (l) => yesRank(l.specs.stabilized), format: (l) => yesNo(l.specs.stabilized) },
      { key: "weatherSealed", label: "Weather sealed", better: "higher", rank: (l) => yesRank(l.specs.weatherSealed), format: (l) => yesNo(l.specs.weatherSealed) },
      { key: "internalZoom", label: "Internal zoom", better: "higher", rank: (l) => yesRank(l.specs.internalZoom), format: (l) => yesNo(l.specs.internalZoom) },
      { key: "apertureRing", label: "Aperture ring", better: "higher", rank: (l) => yesRank(l.specs.apertureRing), format: (l) => yesNo(l.specs.apertureRing) },
      { key: "teleconverter", label: "Teleconverter compatible", better: null, format: (l) => yesNo(l.specs.teleconverter) },
    ],
  },
  {
    id: "size",
    title: "Size & weight",
    specs: [
      { key: "weightG", label: "Weight", better: "lower", rank: s("weightG"), format: (l) => num(l.specs.weightG, " g") },
      { key: "size", label: "Diameter × length", better: null, format: (l) => (l.specs.diameterMm && l.specs.lengthMm ? `${num(l.specs.diameterMm)} × ${num(l.specs.lengthMm)} mm` : null) },
      { key: "filterMm", label: "Filter thread", better: null, format: (l) => (l.specs.filterMm ? `${num(l.specs.filterMm)} mm` : null) },
    ],
  },
];
