// "Suggested kit": this body, a standard zoom, a fast prime and a telephoto
// (or a wide when no telephoto fits). Deterministic, from the catalog and
// today's offers only: no AI and nothing fetched at request time. A pick is a
// starting point we can explain in one sentence from the spec sheet, never a
// claim about what other buyers bought.
//
// Rules, in order:
// - Native lenses only (same mount, image circle covers the sensor), with
//   autofocus, and no APS-C lens on a full-frame body (it crops the frame).
// - Each role is a 35mm-equivalent focal range on THIS body (cropOn).
// - Price band: each role has a target share of the body's price and a cap
//   (a $700 body doesn't get a $2,400 zoom). Without a body price the band is
//   dropped and the cheapest priced lens of the maker wins.
// - Prefer: priced in this market today, the camera maker's own lenses (or
//   its mount alliance), then the well-known third-party makers, current
//   models over discontinued ones. Ties go to the newer lens, then the slug.
import type { Camera, Lens } from "./catalog/schema";
import { lensCropsOn } from "./catalog";
import { cropOn } from "./specs/lens";

export type KitRole = "standard-zoom" | "fast-prime" | "telephoto" | "wide";

export type KitPick = {
  role: KitRole;
  lens: Lens;
  /** Lowest new price today in the market, minor units of its own currency; null when unpriced. */
  price: number | null;
  /** 35mm-equivalent focal range on this body, rounded. */
  eq: [number, number];
  reason: string;
};

/** Makers whose lenses count as the mount's own on a shared mount, whoever made the body. */
const ALLIANCE: Record<string, string[]> = {
  "l-mount": ["panasonic", "leica", "sigma"],
  "micro-four-thirds": ["om-system", "panasonic"],
};
/** Third-party lens makers buyers know and that sell autofocus lenses in most mounts. */
export const KNOWN_THIRD_PARTY = ["sigma", "tamron", "samyang", "zeiss", "tokina", "viltrox"];

type RoleSpec = {
  role: KitRole;
  fits: (l: Lens, lo: number, hi: number) => boolean;
  /** Target price as a share of the body's price, and the most it may cost. */
  target: number;
  cap: number;
  /** Extra preference within the role (lower is better). */
  shape?: (l: Lens, lo: number, hi: number) => number;
};

const zoom = (l: Lens) => l.specs.focalMaxMm > l.specs.focalMinMm;

const ROLES: Record<KitRole, RoleSpec> = {
  "standard-zoom": {
    role: "standard-zoom",
    fits: (l, lo, hi) => zoom(l) && lo >= 20 && lo <= 32 && hi >= 60 && hi <= 160,
    target: 0.45,
    cap: 1.1,
    // The classic 24-70/24-105 shape: starts near 24-28mm equivalent.
    shape: (_l, lo) => Math.abs(lo - 25) / 40,
  },
  "fast-prime": {
    role: "fast-prime",
    fits: (l, lo) => !zoom(l) && l.specs.apertureMax <= 2 && lo >= 33 && lo <= 90 && (l.specs.maxMagnification ?? 0) < 0.5,
    target: 0.2,
    cap: 0.7,
    // Nearest a 50mm equivalent, brighter is better.
    shape: (l, lo) => Math.abs(Math.log(lo / 50)) * 0.6 + (l.specs.apertureMax > 1.8 ? 0.15 : 0),
  },
  telephoto: {
    role: "telephoto",
    fits: (l, lo, hi) => zoom(l) && lo >= 50 && lo <= 160 && hi >= 180 && hi <= 450,
    target: 0.45,
    cap: 1.1,
    shape: (_l, _lo, hi) => Math.abs(Math.log(hi / 300)) * 0.3,
  },
  wide: {
    role: "wide",
    fits: (l, lo, hi) => lo <= 24 && (zoom(l) ? hi <= 40 : true) && (l.specs.maxMagnification ?? 0) < 0.5,
    target: 0.35,
    cap: 1,
    shape: (_l, lo) => Math.abs(lo - 16) / 30,
  },
};

const eqOf = (l: Lens, c: Camera): [number, number] => {
  const k = cropOn(l, c);
  return [Math.round(l.specs.focalMinMm * k), Math.round(l.specs.focalMaxMm * k)];
};

export const isOwnLens = (l: Lens, c: Camera) => l.brand === c.brand || Boolean(c.mount && ALLIANCE[c.mount]?.includes(l.brand));

function score(spec: RoleSpec, l: Lens, c: Camera, p: number | null, ref: number | null, eq: [number, number]): number | null {
  if (p !== null && ref !== null && p > ref * spec.cap) return null; // out of the band
  let s = 0;
  if (p === null) s += 3;
  else if (ref !== null) s += Math.abs(Math.log(p / (ref * spec.target)));
  else s += Math.log10(p) * 0.5; // no body price at all: cheaper is safer
  if (!isOwnLens(l, c)) s += 0.35;
  if (l.status === "discontinued") s += 0.5;
  s += spec.shape?.(l, eq[0], eq[1]) ?? 0;
  return s;
}

const focal = ([a, b]: [number, number]) => (a === b ? `${a}mm` : `${a}–${b}mm`);

function reasonFor(role: KitRole, l: Lens, c: Camera, eq: [number, number], makerName: string): string {
  const range = `${focal(eq)}${cropOn(l, c) === 1 ? "" : " equivalent"}`;
  const who = isOwnLens(l, c) ? `${makerName}'s own` : "A well-known third-party";
  switch (role) {
    case "standard-zoom":
      return `${who} standard zoom at a price that suits this body: ${range} covers rooms, street and portraits.`;
    case "fast-prime":
      return `A bright f/${l.specs.apertureMax} prime for low light and soft backgrounds, at ${range}.`;
    case "telephoto":
      return `Reaches ${range} for sport, wildlife and faraway detail.`;
    case "wide":
      return `Goes as wide as ${focal([eq[0], eq[0]])}${cropOn(l, c) === 1 ? "" : " equivalent"} for landscapes, buildings and tight interiors.`;
  }
}

/**
 * The suggested kit for a body. `lenses` are its native lenses (lensesFor);
 * `priceOf` gives today's lowest new price in the market (minor units, its own
 * currency) or null; `bodyPrice` is the body's (new, else used, else launch),
 * in the same currency, or null.
 */
export function suggestKit(c: Camera, lenses: Lens[], priceOf: (slug: string) => number | null, bodyPrice: number | null, makerName = c.brand): KitPick[] {
  if (!c.mount) return [];
  const pool = lenses.filter((l) => l.specs.autofocus && !lensCropsOn(l, c) && (isOwnLens(l, c) || KNOWN_THIRD_PARTY.includes(l.brand)));
  const used = new Set<string>();
  const pick = (spec: RoleSpec): KitPick | null => {
    let best: { l: Lens; s: number; p: number | null; eq: [number, number] } | null = null;
    for (const l of pool) {
      if (used.has(l.slug)) continue;
      const eq = eqOf(l, c);
      if (!spec.fits(l, eq[0], eq[1])) continue;
      const p = priceOf(l.slug);
      const s = score(spec, l, c, p, bodyPrice, eq);
      if (s === null) continue;
      if (!best || s < best.s - 1e-9 || (Math.abs(s - best.s) <= 1e-9 && (l.announced > best.l.announced || (l.announced === best.l.announced && l.slug < best.l.slug)))) best = { l, s, p, eq };
    }
    if (!best) return null;
    used.add(best.l.slug);
    return { role: spec.role, lens: best.l, price: best.p, eq: best.eq, reason: reasonFor(spec.role, best.l, c, best.eq, makerName) };
  };
  const out: KitPick[] = [];
  for (const role of ["standard-zoom", "fast-prime"] as const) {
    const p = pick(ROLES[role]);
    if (p) out.push(p);
  }
  const third = pick(ROLES.telephoto) ?? pick(ROLES.wide);
  if (third) out.push(third);
  // A kit is at least a zoom or two lenses; one stray prime is not a kit.
  return out.length >= 2 || out[0]?.role === "standard-zoom" ? out : [];
}

/** Body plus every priced lens, and how many items were left out unpriced. */
export function kitTotal(bodyPrice: number | null, picks: KitPick[]): { total: number; missing: number } {
  const prices = [bodyPrice, ...picks.map((p) => p.price)];
  return { total: prices.reduce<number>((s, p) => s + (p ?? 0), 0), missing: prices.filter((p) => p === null).length };
}
