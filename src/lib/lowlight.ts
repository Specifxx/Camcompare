// Low light, honestly. A spec sheet's ISO range says nothing about noise at
// ISO 6400. We don't have measurements of our own, so this gives the one
// number the catalog does support (how much sensor each pixel gets: bigger
// pixels gather more light, all else equal) and sends the buyer to the sites
// that measure noise or shoot the same scene at high ISO. Their images and
// charts are theirs: we link, never copy (owner feedback, 2026-10-17).
import type { Camera } from "./catalog/schema";
import PTP_NAMES from "../../data/ptp-names.json";
import { sensorArea } from "./specs/definitions";

/** Approximate light-gathering area per pixel, in square micrometres. */
export function pixelAreaUm2(c: Camera): number {
  // Only ever called for a camera with a published sensor size (LowLight is not drawn for camera glasses).
  return (sensorArea(c.specs.sensorFormat ?? "1/2.8-inch") * 1e6) / (c.specs.megapixels * 1e6);
}

/** Pixel pitch in micrometres (the side of a square pixel of that area). */
export const pixelPitchUm = (c: Camera) => Math.sqrt(pixelAreaUm2(c));

/**
 * The camera's name on Photons to Photos ("Nikon Z 6II", "Sony ILCE-7M4"),
 * from its own list (data/ptp-names.json, `npx tsx scripts/sync-ptp-names.ts`),
 * or null when it hasn't measured that body.
 */
export function ptpName(c: Camera): string | null {
  return (PTP_NAMES as Record<string, string>)[c.slug] ?? null;
}

export type LowLightLink = { label: string; note: string; href: string };

/** A product's name as review sites and search boxes spell it: "Sony a7 IV" (α as a). Also used by lib/reviews.ts. */
export const searchName = (p: { shortName: string }, brandName: string) => `${brandName} ${p.shortName.replace(/α/g, "a")}`;

export function lowLightLinks(cams: { c: Camera; brandName: string }[]): LowLightLink[] {
  const names = cams.map(({ c, brandName }) => searchName(c, brandName));
  const q = encodeURIComponent(names.join(" vs "));
  // Only bodies Photons to Photos has measured; with none, the chart opens empty to pick from.
  const ptp = cams.map(({ c }) => ptpName(c)).filter(Boolean).join(",");
  const hash = ptp ? `#${encodeURI(ptp)}` : "";
  return [
    { label: "Photons to Photos: dynamic range vs ISO", note: "Photographic dynamic range measured at every ISO, bodies on one chart", href: `https://www.photonstophotos.net/Charts/PDR.htm${hash}` },
    { label: "Photons to Photos: noise vs ISO", note: "Read noise at every ISO from lab tests: lower is cleaner in the shadows", href: `https://www.photonstophotos.net/Charts/RN_ADU.htm${hash}` },
    { label: "DPReview studio scene", note: "The same scene shot by each camera at the ISO you pick, side by side", href: "https://www.dpreview.com/reviews/image-comparison" },
    { label: "DPReview reviews", note: "Full reviews with high-ISO samples", href: `https://www.dpreview.com/search?query=${encodeURIComponent(names[0])}` },
    { label: "Low-light video tests", note: "Real-world high-ISO footage on YouTube", href: `https://www.youtube.com/results?search_query=${q}+low+light+test` },
  ];
}
