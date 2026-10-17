// Low light, honestly. A spec sheet's ISO range says nothing about noise at
// ISO 6400. We don't have measurements of our own, so this gives the one
// number the catalog does support (how much sensor each pixel gets: bigger
// pixels gather more light, all else equal) and sends the buyer to the sites
// that measure noise or shoot the same scene at high ISO. Their images and
// charts are theirs: we link, never copy (owner feedback, 2026-10-17).
import type { Camera } from "./catalog/schema";
import { sensorArea } from "./specs/definitions";

/** Approximate light-gathering area per pixel, in square micrometres. */
export function pixelAreaUm2(c: Camera): number {
  return (sensorArea(c.specs.sensorFormat) * 1e6) / (c.specs.megapixels * 1e6);
}

/** Pixel pitch in micrometres (the side of a square pixel of that area). */
export const pixelPitchUm = (c: Camera) => Math.sqrt(pixelAreaUm2(c));

/**
 * The name Photons to Photos uses: Sony and Panasonic by model code
 * ("Sony ILCE-7M4", "Panasonic DC-S5M2"), everyone else by name.
 * A name it doesn't know just doesn't plot; the chart lets you add it.
 */
export function ptpName(c: Camera, brandName: string): string {
  const code = c.modelCodes[0];
  if ((c.brand === "sony" || c.brand === "panasonic") && code) return `${brandName} ${code}`;
  return `${brandName} ${c.shortName.replace(/α/g, "a")}`;
}

export type LowLightLink = { label: string; note: string; href: string };

export function lowLightLinks(cams: { c: Camera; brandName: string }[]): LowLightLink[] {
  const names = cams.map(({ c, brandName }) => `${brandName} ${c.shortName.replace(/α/g, "a")}`);
  const q = encodeURIComponent(names.join(" vs "));
  const ptp = cams.map(({ c, brandName }) => ptpName(c, brandName)).join(",");
  return [
    { label: "Photons to Photos: dynamic range", note: "Measured noise and dynamic range at every ISO, charted together", href: `https://www.photonstophotos.net/Charts/PDR.htm#${encodeURI(ptp)}` },
    { label: "Photons to Photos: read noise", note: "Input-referred read noise by ISO: lower is cleaner in the shadows", href: `https://www.photonstophotos.net/Charts/RN_e.htm#${encodeURI(ptp)}` },
    { label: "DPReview studio scene", note: "The same scene shot by each camera at the ISO you pick, side by side", href: "https://www.dpreview.com/reviews/image-comparison" },
    { label: "DPReview reviews", note: "Full reviews with high-ISO samples", href: `https://www.dpreview.com/search?query=${encodeURIComponent(names[0])}` },
    { label: "Low-light video tests", note: "Real-world high-ISO footage on YouTube", href: `https://www.youtube.com/results?search_query=${q}+low+light+test` },
  ];
}
