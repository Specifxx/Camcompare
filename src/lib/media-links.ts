// Videos and discussions for a product page: links to YouTube's and
// Reddit's own searches, a maker's official channel, DPReview's forums. We
// link, never copy or embed (an embed needs a specific video ID from our own
// data, which the catalog doesn't have yet: `videos` below takes them when it
// does). Every official channel here was opened on 2026-10-22 and is the
// maker's own; a brand without a checked one gets none.
import type { Camera, Lens } from "./catalog/schema";
import { searchName } from "./lowlight";

export type MediaLink = { label: string; note: string; href: string };

export const OFFICIAL_CHANNEL: Record<string, { name: string; href: string }> = {
  canon: { name: "Canon USA", href: "https://www.youtube.com/@CanonUSA" },
  nikon: { name: "Nikon USA", href: "https://www.youtube.com/@NikonUSA" },
  sony: { name: "Sony | Alpha Universe", href: "https://www.youtube.com/@SonyAlphaUniverse" },
  fujifilm: { name: "FUJIFILM X Series", href: "https://www.youtube.com/@fujifilmxseries" },
  panasonic: { name: "LUMIX USA", href: "https://www.youtube.com/@LumixUSA" },
  "om-system": { name: "OM SYSTEM Cameras", href: "https://www.youtube.com/@OMSYSTEMCameras" },
  sigma: { name: "SIGMA", href: "https://www.youtube.com/@SigmaGlobalVision" },
  dji: { name: "DJI", href: "https://www.youtube.com/@DJI" },
  gopro: { name: "GoPro", href: "https://www.youtube.com/@GoPro" },
  insta360: { name: "Insta360", href: "https://www.youtube.com/@insta360" },
};

const yt = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

/** YouTube searches (review, versus its first rival, low light or sample photos) and the maker's channel. */
export function videoLinks(p: Camera | Lens, kind: "camera" | "lens", brandName: string, rival?: { item: Camera | Lens; brandName: string } | null): MediaLink[] {
  const name = searchName(p, brandName);
  const out: MediaLink[] = [{ label: `${p.shortName} review`, note: "Video reviews", href: yt(`${name} review`) }];
  if (rival) out.push({ label: `${p.shortName} vs ${rival.item.shortName}`, note: "Side-by-side comparisons", href: yt(`${name} vs ${searchName(rival.item, rival.brandName)}`) });
  if (kind === "camera") {
    out.push({ label: `${p.shortName} in low light`, note: "Noise and autofocus in the dark", href: yt(`${name} low light test`) });
    if ((p as Camera).specs.videoMaxRes) out.push({ label: `${p.shortName} sample footage`, note: "Straight-out-of-camera video", href: yt(`${name} sample footage`) });
  } else {
    out.push({ label: `${p.shortName} sample photos`, note: "Sharpness, bokeh and flare", href: yt(`${name} sample images`) });
  }
  const ch = OFFICIAL_CHANNEL[p.brand];
  if (ch) out.push({ label: `${ch.name} on YouTube`, note: "The maker's official channel", href: ch.href });
  return out;
}

const SUB_BY_BRAND: Record<string, string> = { canon: "canon", sony: "SonyAlpha", fujifilm: "fujifilm", nikon: "Nikon", "om-system": "M43" };
const SUB_BY_MOUNT: Record<string, string> = {
  "sony-e": "SonyAlpha",
  "canon-rf": "canon",
  "canon-ef": "canon",
  "canon-ef-m": "canon",
  "nikon-z": "Nikon",
  "nikon-f": "Nikon",
  "fujifilm-x": "fujifilm",
  "fujifilm-g": "fujifilm",
  "micro-four-thirds": "M43",
};

/** The subreddits that talk about it: the maker's or mount's, r/photography, and r/videography for video-first bodies. */
export function subreddits(p: Camera | Lens, kind: "camera" | "lens"): string[] {
  const mounts = kind === "camera" ? [(p as Camera).mount].filter((x): x is string => Boolean(x)) : (p as Lens).mounts;
  const own = (p.brand === "panasonic" || kind === "lens" ? mounts.map((m) => SUB_BY_MOUNT[m]).find(Boolean) : null) ?? SUB_BY_BRAND[p.brand] ?? mounts.map((m) => SUB_BY_MOUNT[m]).find(Boolean);
  const video = kind === "camera" && ((p as Camera).type === "cinema" || (p as Camera).specs.video10bit === true);
  return [...new Set([own, "photography", video ? "videography" : null].filter((x): x is string => Boolean(x)))];
}

/** Reddit searches in each subreddit, and DPReview's forums (browsed, not searched: its search answers bots with a challenge). */
export function discussionLinks(p: Camera | Lens, kind: "camera" | "lens", brandName: string): MediaLink[] {
  const own = encodeURIComponent(p.shortName.replace(/α/g, "a"));
  const full = encodeURIComponent(searchName(p, brandName));
  const out: MediaLink[] = subreddits(p, kind).map((s) => {
    const general = s === "photography" || s === "videography";
    return { label: `r/${s}`, note: s === "photography" ? "General photography" : s === "videography" ? "Filmmakers" : `${s === "M43" ? "Micro Four Thirds" : brandName} owners`, href: `https://www.reddit.com/r/${s}/search/?q=${general ? full : own}&restrict_sr=1` };
  });
  out.push({ label: "DPReview forums", note: `Find the ${brandName} forum`, href: "https://www.dpreview.com/forums/" });
  return out;
}
