// The small per-product record client components get (browse filters, the
// finder, search, compare picker). Keeps full spec sheets out of client bundles.
import type { Camera, Lens } from "./catalog/schema";
import { brandName, displayName, displayShortName, launchPrice, offersFor } from "./catalog";
import { MARKETS, type MarketCode } from "./markets";
import { lowest } from "./offers";
import { thumbSrc } from "./thumb";
import { cropFactor, lensCategories } from "./specs/lens";
import type { Base, CameraSummary, LensSummary } from "./summary-types";

export type { CameraSummary, LensSummary, ProductSummary } from "./summary-types";
export { priceOf } from "./summary-types";

function base(p: Camera | Lens, m: MarketCode): Base {
  const offers = offersFor(p.slug, m);
  return {
    slug: p.slug,
    name: displayName(p, m),
    shortName: displayShortName(p, m),
    brand: p.brand,
    brandName: brandName(p.brand),
    announced: p.announced,
    status: p.status,
    currency: MARKETS[m].currency,
    launch: launchPrice(p, m)?.amount ?? null,
    lowestNew: lowest(offers, "new")?.price ?? null,
    lowestUsed: lowest(offers, "used")?.price ?? null,
    thumb: thumbSrc(p.slug),
    weightG: p.specs.weightG,
    sealed: p.specs.weatherSealed,
  };
}

export function summarizeCamera(c: Camera, m: MarketCode): CameraSummary {
  const s = c.specs;
  return {
    ...base(c, m),
    kind: "camera",
    type: c.type,
    sensor: s.sensorFormat,
    mount: c.mount,
    megapixels: s.megapixels,
    ibis: s.ibis,
    videoMaxRes: s.videoMaxRes,
    video4kMaxFps: s.video4kMaxFps,
    burstFps: Math.max(s.burstMechFps ?? 0, s.burstElecFps ?? 0) || null,
    evf: s.viewfinderType !== "none",
    articulating: s.screenType === "fully-articulating" || s.screenType === "flip-up" || s.screenType === "multi-angle",
    micJack: s.micJack,
    dims: s.dimensionsMm,
    subjects: s.afSubjects,
    waterproofM: s.waterproofM,
    fixedZoom: Boolean(c.fixedLens?.focalMm && c.fixedLens.focalMm.length === 2),
  };
}

export function summarizeLens(l: Lens, m: MarketCode): LensSummary {
  const k = cropFactor(l);
  return {
    ...base(l, m),
    kind: "lens",
    mounts: l.mounts,
    coverage: l.coverage,
    focalMin: l.specs.focalMinMm,
    focalMax: l.specs.focalMaxMm,
    eqMin: Math.round(l.specs.focalMinMm * k),
    eqMax: Math.round(l.specs.focalMaxMm * k),
    aperture: l.specs.apertureMax,
    apertureTele: l.specs.apertureMaxTele,
    autofocus: l.specs.autofocus,
    stabilized: l.specs.stabilized,
    categories: lensCategories(l),
  };
}

