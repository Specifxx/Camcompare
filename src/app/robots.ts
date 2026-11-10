import type { MetadataRoute } from "next";
import { abs } from "@/lib/site";

// Query URLs are disallowed (SEO-2, 2026-11-10): every page carried ~34 followed filter links (/cameras?type=,
// ?sensor=, ?mount=) that Google crawled as "Duplicate without user-selected canonical", and no sitemap URL has a
// query string. /compare?c=… is noindex already, so blocking it costs nothing; /saved is crawlable but noindex.
// The longest matching rule wins, so each Allow beats "/*?": Next's assets (?dpl=), share images and icons, and a
// shared link (?utm_source=share) so X's and Reddit's preview fetchers can draw its card.
// /admin is the exception: the owner's private page (a 404 to anyone without
// the admin link), Disallowed as well as noindex.
//
// Bulk crawlers that send nobody are blocked, as on RiftCompare (owner,
// 2026-11-02: Vercel spend capped). Google, Bing, the AI answer engines,
// AhrefsBot and SemrushBot stay allowed.
const QUERY_ALLOWS = ["/_next/", "/*opengraph-image", "/*twitter-image", "/icon", "/apple-icon", "/*utm_source=share"];

const BLOCKED_BOTS = [
  "Bytespider", "meta-externalagent", "Meta-ExternalAgent",
  "MJ12bot", "DotBot", "PetalBot", "DataForSeoBot", "BLEXBot", "Barkrowler", "serpstatbot", "SeekportBot", "ImagesiftBot", "Timpibot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", ...QUERY_ALLOWS], disallow: ["/api/", "/admin", "/*?"] },
      { userAgent: BLOCKED_BOTS, disallow: "/" },
    ],
    sitemap: abs("/sitemap.xml"),
  };
}
