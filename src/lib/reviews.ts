// "Reviews": links to the review sites' own search for a product. We link,
// never copy: a review's words and photos are its site's (owner feedback,
// 2026-10-17). Each pattern below was opened on 2026-10-17 with a camera and
// a lens name and returned that site's results page. Left out because they
// can't be linked that way: DPReview and PetaPixel (their search answers
// with a Cloudflare challenge, 403, so it isn't a link we can vouch for;
// DPReview's studio scene and search stay in the Low light panel, which
// owns them) and the Lensrentals blog (no search URL).
import { searchName } from "./lowlight";

export type ReviewLink = { site: string; note: string; href: string };

export function reviewLinks(p: { shortName: string }, brandName: string, kind: "camera" | "lens"): ReviewLink[] {
  const name = searchName(p, brandName);
  const q = encodeURIComponent(name);
  const qr = encodeURIComponent(`${name} review`);
  return [
    { site: "Digital Camera World", note: "Reviews and buying guides", href: `https://www.digitalcameraworld.com/search?searchTerm=${q}` },
    { site: "Camera Labs", note: kind === "camera" ? "In-depth reviews with sample images" : "Lens reviews with sharpness tests", href: `https://www.cameralabs.com/?s=${q}` },
    { site: "Imaging Resource", note: "Lab and field tests", href: `https://www.imaging-resource.com/?s=${q}` },
    { site: "Amateur Photographer", note: "Reviews and verdicts", href: `https://amateurphotographer.com/?s=${q}` },
    { site: "YouTube", note: "Video reviews", href: `https://www.youtube.com/results?search_query=${qr}` },
    { site: "Reddit r/photography", note: "Owners' opinions", href: `https://www.reddit.com/r/photography/search/?q=${q}&restrict_sr=1` },
  ];
}
