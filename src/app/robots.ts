import type { MetadataRoute } from "next";
import { abs } from "@/lib/site";

// /compare?c=… and /saved are crawlable but noindex (their own metadata), so
// Google sees the noindex instead of a Disallow hiding it — RiftCompare's rule.
// /admin is the exception: the owner's private page (a 404 to anyone without
// the admin link), Disallowed as well as noindex.
//
// Bulk crawlers that send nobody are blocked, as on RiftCompare (owner,
// 2026-11-02: Vercel spend capped). Google, Bing, the AI answer engines,
// AhrefsBot and SemrushBot stay allowed.
const BLOCKED_BOTS = [
  "Bytespider", "meta-externalagent", "Meta-ExternalAgent",
  "MJ12bot", "DotBot", "PetalBot", "DataForSeoBot", "BLEXBot", "Barkrowler", "serpstatbot", "SeekportBot", "ImagesiftBot", "Timpibot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] },
      { userAgent: BLOCKED_BOTS, disallow: "/" },
    ],
    sitemap: abs("/sitemap.xml"),
  };
}
