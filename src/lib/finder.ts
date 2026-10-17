// The camera finder's rules: what each use needs, written as plain spec
// tests so every recommendation can say exactly why it was picked. No
// hidden weights, no paid placement. Client-safe.
import type { CameraSummary } from "./summary-types";

export type Use = "everyday" | "vlogging" | "action-sports" | "wildlife" | "landscape" | "portrait" | "adventure";
export type Size = "pocket" | "small" | "any";

type Rule = { label: string; test: (c: CameraSummary) => boolean; weight: number };

const big = (c: CameraSummary) => c.sensor === "full-frame" || c.sensor === "medium-format";
const largeish = (c: CameraSummary) => big(c) || c.sensor === "aps-c" || c.sensor === "micro-four-thirds" || c.sensor === "super-35";

export const USES: Record<Use, { label: string; blurb: string; types: CameraSummary["type"][]; rules: Rule[] }> = {
  everyday: {
    label: "Everyday & travel",
    blurb: "Light, versatile, good in low light.",
    types: ["mirrorless", "compact", "rangefinder", "dslr"],
    rules: [
      { label: "Under 500 g", test: (c) => (c.weightG ?? 9999) <= 500, weight: 3 },
      { label: "In-body stabilisation", test: (c) => Boolean(c.ibis), weight: 2 },
      { label: "Built-in zoom lens", test: (c) => c.fixedZoom, weight: 1 },
      { label: "Large sensor", test: largeish, weight: 2 },
      { label: "Viewfinder", test: (c) => c.evf, weight: 1 },
    ],
  },
  vlogging: {
    label: "Vlogging & video",
    blurb: "Screen you can see, a mic input, clean 4K.",
    types: ["mirrorless", "compact", "cinema"],
    rules: [
      { label: "Flip or articulating screen", test: (c) => c.articulating, weight: 3 },
      { label: "Mic input", test: (c) => Boolean(c.micJack), weight: 3 },
      { label: "4K at 60p", test: (c) => (c.video4kMaxFps ?? 0) >= 60, weight: 2 },
      { label: "In-body stabilisation", test: (c) => Boolean(c.ibis), weight: 2 },
      { label: "Under 600 g", test: (c) => (c.weightG ?? 9999) <= 600, weight: 1 },
    ],
  },
  "action-sports": {
    label: "Sports & kids",
    blurb: "Fast bursts and subject-tracking autofocus.",
    types: ["mirrorless", "dslr"],
    rules: [
      { label: "20 fps or faster", test: (c) => (c.burstFps ?? 0) >= 20, weight: 3 },
      { label: "10 fps or faster", test: (c) => (c.burstFps ?? 0) >= 10, weight: 1 },
      { label: "Subject detection", test: (c) => Boolean(c.subjects?.length), weight: 2 },
      { label: "Weather sealed", test: (c) => Boolean(c.sealed), weight: 1 },
    ],
  },
  wildlife: {
    label: "Wildlife & birds",
    blurb: "Animal and bird detection, speed, reach.",
    types: ["mirrorless", "dslr", "compact"],
    rules: [
      { label: "Bird or animal detection", test: (c) => Boolean(c.subjects?.some((s) => s === "bird" || s === "animal")), weight: 3 },
      { label: "15 fps or faster", test: (c) => (c.burstFps ?? 0) >= 15, weight: 2 },
      { label: "Weather sealed", test: (c) => Boolean(c.sealed), weight: 2 },
      { label: "Built-in long zoom", test: (c) => c.fixedZoom, weight: 1 },
    ],
  },
  landscape: {
    label: "Landscape & studio",
    blurb: "Resolution and a sealed body.",
    types: ["mirrorless", "dslr", "medium-format", "rangefinder"],
    rules: [
      { label: "40 MP or more", test: (c) => c.megapixels >= 40, weight: 3 },
      { label: "Full frame or larger", test: big, weight: 2 },
      { label: "Weather sealed", test: (c) => Boolean(c.sealed), weight: 2 },
      { label: "In-body stabilisation", test: (c) => Boolean(c.ibis), weight: 1 },
    ],
  },
  portrait: {
    label: "Portraits & weddings",
    blurb: "Full-frame look and eye-detect autofocus.",
    types: ["mirrorless", "dslr", "rangefinder", "medium-format"],
    rules: [
      { label: "Full frame or larger", test: big, weight: 3 },
      { label: "Eye/face detection", test: (c) => Boolean(c.subjects?.includes("human")), weight: 2 },
      { label: "24 MP or more", test: (c) => c.megapixels >= 24, weight: 1 },
      { label: "In-body stabilisation", test: (c) => Boolean(c.ibis), weight: 1 },
    ],
  },
  adventure: {
    label: "Adventure & water",
    blurb: "Tough, waterproof, mountable.",
    types: ["action", "360", "compact"],
    rules: [
      { label: "Waterproof without a housing", test: (c) => (c.waterproofM ?? 0) > 0, weight: 3 },
      { label: "4K at 60p", test: (c) => (c.video4kMaxFps ?? 0) >= 60, weight: 2 },
      { label: "Under 200 g", test: (c) => (c.weightG ?? 9999) <= 200, weight: 1 },
    ],
  },
};

export const SIZES: Record<Size, { label: string; test: (c: CameraSummary) => boolean }> = {
  pocket: { label: "Fits a jacket pocket", test: (c) => (c.weightG ?? 9999) <= 350 || c.type === "action" },
  small: { label: "Small and light", test: (c) => (c.weightG ?? 9999) <= 650 },
  any: { label: "Size doesn't matter", test: () => true },
};

export function recommend(cams: CameraSummary[], use: Use, size: Size, budget: number | null, priceOf: (c: CameraSummary) => number | null) {
  const u = USES[use];
  return cams
    .filter((c) => u.types.includes(c.type) && SIZES[size].test(c))
    .filter((c) => budget === null || ((priceOf(c) ?? Infinity) <= budget))
    .map((c) => {
      const reasons = u.rules.filter((r) => r.test(c));
      return { c, reasons: reasons.map((r) => r.label), score: reasons.reduce((a, r) => a + r.weight, 0) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.c.status === "current") - Number(a.c.status === "current") || b.c.announced.localeCompare(a.c.announced));
}
