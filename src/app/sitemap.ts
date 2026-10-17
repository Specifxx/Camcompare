import type { MetadataRoute } from "next";
import { indexedPairs, offersFor, pairSlug, publishedCameras, publishedLenses } from "@/lib/catalog";
import { MARKET_CODES, marketPath } from "@/lib/markets";
import { guides } from "@/lib/guides";
import { abs } from "@/lib/site";
import { BOARDS } from "@/lib/community/rules";
import { categorySummaries } from "@/lib/accessory-rows";
import { liveBrands } from "@/views/BrandView";
import { dealsIndexable } from "@/views/DealsView";
import { liveMounts } from "@/views/MountView";

// Only pages that are indexed: every US product page, and a market's product
// page once that market has prices for it (the same rule as the noindex).
// Deals pages once they have deals (dealsIndexable).
export default function sitemap(): MetadataRoute.Sitemap {
  const out: MetadataRoute.Sitemap = [];
  for (const m of MARKET_CODES) {
    for (const p of ["/", "/cameras", "/lenses", "/finder", "/brands", "/mounts"]) out.push({ url: abs(marketPath(m, p)) });
    if (dealsIndexable(m)) out.push({ url: abs(marketPath(m, "/deals")) });
    const acc = categorySummaries(m); // accessory pages only where that market has listings
    if (acc.length) out.push({ url: abs(marketPath(m, "/accessories")) }, ...acc.map((s) => ({ url: abs(marketPath(m, `/accessories/${s.slug}`)) })));
    for (const b of liveBrands()) out.push({ url: abs(marketPath(m, `/brands/${b.slug}`)) });
    for (const mt of liveMounts()) out.push({ url: abs(marketPath(m, `/mounts/${mt.slug}`)) });
    for (const c of publishedCameras()) if (m === "us" || offersFor(c.slug, m).length) out.push({ url: abs(marketPath(m, `/cameras/${c.slug}`)) });
    for (const l of publishedLenses()) if (m === "us" || offersFor(l.slug, m).length) out.push({ url: abs(marketPath(m, `/lenses/${l.slug}`)) });
  }
  for (const [a, b] of indexedPairs()) out.push({ url: abs(`/compare/${pairSlug(a.item, b.item)}`) });
  out.push({ url: abs("/guides") }, ...guides().map((g) => ({ url: abs(`/guides/${g.slug}`), lastModified: g.updated || undefined })));
  out.push({ url: abs("/about") });
  out.push({ url: abs("/community") }, ...BOARDS.map((b) => ({ url: abs(`/community/${b.slug}`) })));
  return out;
}
