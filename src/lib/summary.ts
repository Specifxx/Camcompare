// The small per-camera record client components get (browse filters, the
// compare picker). Keeps the full spec sheet out of client bundles.
import type { Camera } from "./catalog/schema";
import { brandName, offersFor } from "./catalog";
import { lowest } from "./offers";
import { thumbSrc } from "./thumb";

export type CameraSummary = {
  slug: string;
  name: string;
  shortName: string;
  brand: string;
  brandName: string;
  type: Camera["type"];
  sensor: Camera["specs"]["sensorFormat"];
  mount: string | null;
  megapixels: number;
  announced: string;
  launchPriceUsd: number | null;
  lowestNewCents: number | null;
  lowestUsedCents: number | null;
  ibis: boolean | null;
  weatherSealed: boolean | null;
  videoMaxRes: string | null;
  weightG: number | null;
  thumb: string;
};

export function summarize(c: Camera): CameraSummary {
  const offers = offersFor(c.slug);
  return {
    slug: c.slug,
    name: c.name,
    shortName: c.shortName,
    brand: c.brand,
    brandName: brandName(c.brand),
    type: c.type,
    sensor: c.specs.sensorFormat,
    mount: c.mount,
    megapixels: c.specs.megapixels,
    announced: c.announced,
    launchPriceUsd: c.launchPriceUsd,
    lowestNewCents: lowest(offers, "new")?.priceCents ?? null,
    lowestUsedCents: lowest(offers, "used")?.priceCents ?? null,
    ibis: c.specs.ibis,
    weatherSealed: c.specs.weatherSealed,
    videoMaxRes: c.specs.videoMaxRes,
    weightG: c.specs.weightG,
    thumb: thumbSrc(c.slug),
  };
}
