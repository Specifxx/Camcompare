import type { MetadataRoute } from "next";
import { abs } from "@/lib/site";

// /compare?c=… and /saved are crawlable but noindex (their own metadata), so
// Google sees the noindex instead of a Disallow hiding it — RiftCompare's rule.
// /admin is the exception: the owner's private page (a 404 to anyone without
// the admin link), Disallowed as well as noindex.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] }], sitemap: abs("/sitemap.xml") };
}
