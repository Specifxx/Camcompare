import type { MetadataRoute } from "next";
import { abs } from "@/lib/site";

// Crawlers get the canonical pages only. Every canonical URL is query-free
// (the sitemap lists no query URL), so "/*?" keeps bots off the variants that
// cost something: /compare?c=… (rendered per request), the browse pages'
// ?brand=/&sort= filters and ?view= quick views (the same static page again).
// /api/ and /admin are private; /alerts/ is token links; /saved is a
// per-browser list. All of these are noindex as well.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/*?", "/api/", "/admin", "/alerts/", "/saved", "/*/saved"] }], sitemap: abs("/sitemap.xml") };
}
