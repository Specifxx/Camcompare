// Key specs "pointed out" (owner, 2026-10-17): the facts a buyer compares
// first, as 4–8 callout tiles on the product page and in the quick view, and
// two or three chips on a product card. Only catalog facts: a spec that is
// null is skipped, never guessed; a known "no" is shown as one, muted.
// Client-safe.
import type { Camera, Lens } from "./catalog/schema";
import { year } from "./format";
import { num, sensorLabel } from "./specs/definitions";
import { apertureLabel, coverageLabel, equivalentLabel, focalLabel, isZoom } from "./specs/lens";
import type { ProductSummary } from "./summary-types";

export type HighlightIcon = "sensor" | "lens" | "stabilise" | "video" | "focus" | "viewfinder" | "burst" | "weight" | "sealed" | "water" | "aperture" | "motor" | "macro";

export type Highlight = {
  key: string;
  icon: HighlightIcon;
  /** The big text: "33 MP", "5.5 stops", "4K 60p". */
  value: string;
  /** What it is: "Full frame sensor", "In-body stabilisation". */
  label: string;
  /** One more fact from the catalog, small. */
  detail?: string;
  /** A known absence ("None"): shown muted. */
  off?: boolean;
};

export const MAX_HIGHLIGHTS = 8;

const capitalize = (s: string) => s.replace(/^./, (c) => c.toUpperCase());
const dash = (s: string) => s.replace(/-/g, "–");

export function cameraHighlights(c: Camera): Highlight[] {
  const s = c.specs;
  const out: Highlight[] = [{ key: "sensor", icon: "sensor", value: `${num(s.megapixels)} MP`, label: `${sensorLabel(s.sensorFormat)} sensor`, detail: s.sensorType ?? undefined }];

  if (c.fixedLens) {
    const f = c.fixedLens.focalMm;
    const focal = f ? (f.length === 1 ? `${num(f[0])}mm` : `${num(f[0])}–${num(f[1])}mm`) : null;
    const ap = c.fixedLens.aperture ? dash(c.fixedLens.aperture) : null;
    if (focal) out.push({ key: "lens", icon: "lens", value: focal, label: "Built-in lens, 35mm eq.", detail: ap ?? undefined });
    else if (ap) out.push({ key: "lens", icon: "lens", value: ap, label: "Built-in lens" });
  }

  if (s.ibis !== null) {
    out.push(
      s.ibis
        ? { key: "ibis", icon: "stabilise", value: s.ibisStops ? `${num(s.ibisStops)} stops` : "Yes", label: "In-body stabilisation", detail: s.ibisStops ? "CIPA rating" : undefined }
        : { key: "ibis", icon: "stabilise", value: "None", label: "In-body stabilisation", off: true },
    );
  }

  if (s.videoMaxRes) {
    const fps = s.video4kMaxFps;
    const is4k = s.videoMaxRes === "4K";
    const detail = [!is4k && fps ? `4K up to ${num(fps)}p` : null, s.video10bit ? "10-bit internal" : null, s.rawVideoInternal ? "internal raw" : null].filter(Boolean).join(" · ");
    out.push({ key: "video", icon: "video", value: is4k && fps ? `4K ${num(fps)}p` : s.videoMaxRes, label: "Top video mode", detail: detail || undefined });
  }

  if (s.afSubjects?.length) {
    const names = s.afSubjects.map((x, i) => (i === 0 ? capitalize(x) : x));
    const many = names.length > 3;
    out.push({
      key: "af",
      icon: "focus",
      value: many ? `${names.length} subject types` : names.join(", "),
      label: "Subject-detection AF",
      detail: many ? names.join(", ") : s.afPoints ? `${num(s.afPoints)} AF points` : undefined,
    });
  } else if (s.afPoints) {
    out.push({ key: "af", icon: "focus", value: `${num(s.afPoints)} points`, label: "Autofocus" });
  }

  const vf = s.viewfinderType;
  if (vf === "none") out.push({ key: "vf", icon: "viewfinder", value: "None", label: "Viewfinder", off: true });
  else {
    const dots = s.evfDotsM && vf !== "optical" ? `${num(s.evfDotsM, "M", 2)} dots` : null;
    const kind = { electronic: "Electronic", optical: "Optical", hybrid: "Hybrid" }[vf];
    out.push({ key: "vf", icon: "viewfinder", value: dots ?? kind, label: dots ? `${kind} viewfinder` : "Viewfinder", detail: vf === "hybrid" ? "Optical and electronic" : undefined });
  }

  const mech = s.burstMechFps;
  const elec = s.burstElecFps;
  const top = Math.max(mech ?? 0, elec ?? 0);
  if (top) {
    const detail =
      mech && elec ? (mech === elec ? "Mechanical and electronic" : top === elec ? `Electronic; ${num(mech)} fps mechanical` : `Mechanical; ${num(elec)} fps electronic`) : elec ? "Electronic shutter" : "Mechanical shutter";
    out.push({ key: "burst", icon: "burst", value: `${num(top)} fps`, label: "Burst shooting", detail });
  }

  if (s.weightG) out.push({ key: "weight", icon: "weight", value: `${num(s.weightG)} g`, label: "Weight with battery" });

  if (s.waterproofM) out.push({ key: "sealed", icon: "water", value: `${num(s.waterproofM)} m`, label: "Waterproof", detail: s.weatherSealed ? "Weather sealed" : undefined });
  else if (s.weatherSealed !== null) out.push({ key: "sealed", icon: "sealed", value: s.weatherSealed ? "Sealed" : "No", label: "Weather sealing", off: !s.weatherSealed });

  // A fixed-lens camera has one tile more than fits: burst goes first, then the finder.
  for (const k of ["burst", "vf"]) {
    if (out.length <= MAX_HIGHLIGHTS) break;
    const i = out.findIndex((h) => h.key === k);
    if (i >= 0) out.splice(i, 1);
  }
  return out.slice(0, MAX_HIGHLIGHTS);
}

export function lensHighlights(l: Lens): Highlight[] {
  const s = l.specs;
  const zoom = isZoom(l);
  const out: Highlight[] = [
    { key: "focal", icon: "lens", value: focalLabel(l), label: zoom ? "Zoom range" : "Focal length", detail: equivalentLabel(l) ?? `${coverageLabel(l.coverage)} lens` },
    { key: "aperture", icon: "aperture", value: apertureLabel(l), label: "Max aperture", detail: zoom ? (s.apertureMaxTele ? "Varies with zoom" : "Constant through the zoom") : undefined },
  ];
  if (s.stabilized !== null) out.push(s.stabilized ? { key: "ois", icon: "stabilise", value: "Built in", label: "Optical stabilisation" } : { key: "ois", icon: "stabilise", value: "None", label: "Optical stabilisation", off: true });
  out.push(s.autofocus ? (s.afMotor ? { key: "af", icon: "motor", value: s.afMotor, label: "Autofocus motor" } : { key: "af", icon: "motor", value: "Yes", label: "Autofocus" }) : { key: "af", icon: "motor", value: "Manual", label: "Focus" });
  if (s.weightG) out.push({ key: "weight", icon: "weight", value: `${num(s.weightG)} g`, label: "Weight" });
  if (s.weatherSealed !== null) out.push({ key: "sealed", icon: "sealed", value: s.weatherSealed ? "Sealed" : "No", label: "Weather sealing", off: !s.weatherSealed });
  if (s.maxMagnification) out.push({ key: "close", icon: "macro", value: num(s.maxMagnification, "×", 2)!, label: "Max magnification", detail: s.minFocusM ? `Focuses to ${num(s.minFocusM, " m", 2)}` : undefined });
  else if (s.minFocusM) out.push({ key: "close", icon: "macro", value: num(s.minFocusM, " m", 2)!, label: "Closest focus" });
  return out.slice(0, MAX_HIGHLIGHTS);
}

/** The line under a card's name: "Full frame · 33 MP · 2021", "24–70mm f/2.8 · 2022". */
export function cardSubline(p: ProductSummary): string {
  if (p.kind === "camera") return `${sensorLabel(p.sensor)} · ${num(p.megapixels)} MP · ${year(p.announced)}`;
  const focal = p.focalMin === p.focalMax ? `${p.focalMin}mm` : `${p.focalMin}–${p.focalMax}mm`;
  return `${focal} ${p.apertureTele ? `f/${p.aperture}–${p.apertureTele}` : `f/${p.aperture}`} · ${year(p.announced)}`;
}

/**
 * Two or three chips on a card, after what its subline already says (sensor
 * and resolution, or focal length and aperture). Only features it has.
 */
export function cardChips(p: ProductSummary, max = 3): string[] {
  const chips =
    p.kind === "camera"
      ? [
          p.ibis ? "IBIS" : null,
          p.videoMaxRes && p.videoMaxRes !== "4K" && p.videoMaxRes !== "1080p" && p.videoMaxRes !== "720p" ? `${p.videoMaxRes} video` : p.video4kMaxFps ? `4K ${num(p.video4kMaxFps)}p` : p.videoMaxRes ? `${p.videoMaxRes} video` : null,
          p.waterproofM ? `Waterproof ${num(p.waterproofM)} m` : p.sealed ? "Weather sealed" : null,
          p.burstFps ? `${num(p.burstFps)} fps` : null,
          p.weightG ? `${num(p.weightG)} g` : null,
        ]
      : [
          p.eqMin !== p.focalMin ? `${p.eqMin === p.eqMax ? `${p.eqMin}mm` : `${p.eqMin}–${p.eqMax}mm`} eq.` : null,
          p.stabilized ? "Stabilised" : null,
          p.autofocus ? null : "Manual focus",
          p.sealed ? "Weather sealed" : null,
          p.weightG ? `${num(p.weightG)} g` : null,
        ];
  return chips.filter((c): c is string => Boolean(c)).slice(0, max);
}
