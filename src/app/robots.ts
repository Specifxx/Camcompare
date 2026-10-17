import type { MetadataRoute } from "next";
import { abs } from "@/lib/site";

// /compare?c=… is crawlable but noindex (its own metadata), so Google sees the
// noindex instead of a Disallow hiding it — RiftCompare's rule.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/" }], sitemap: abs("/sitemap.xml") };
}
