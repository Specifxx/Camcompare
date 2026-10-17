import type { MetadataRoute } from "next";
import { indexedPairs, offersFor, pairSlug, publishedCameras, publishedLenses } from "@/lib/catalog";
import { MARKET_CODES, marketPath } from "@/lib/markets";
import { abs } from "@/lib/site";
import { liveBrands } from "@/views/BrandView";
import { liveMounts } from "@/views/MountView";

// Only pages that are indexed: every US product page, and a market's product
// page once that market has prices for it (the same rule as the noindex).
export default function sitemap(): MetadataRoute.Sitemap {
  const out: MetadataRoute.Sitemap = [];
  for (const m of MARKET_CODES) {
    for (const p of ["/", "/cameras", "/lenses", "/deals", "/finder", "/brands"]) out.push({ url: abs(marketPath(m, p)) });
    for (const b of liveBrands()) out.push({ url: abs(marketPath(m, `/brands/${b.slug}`)) });
    for (const mt of liveMounts()) out.push({ url: abs(marketPath(m, `/mounts/${mt.slug}`)) });
    for (const c of publishedCameras()) if (m === "us" || offersFor(c.slug, m).length) out.push({ url: abs(marketPath(m, `/cameras/${c.slug}`)) });
    for (const l of publishedLenses()) if (m === "us" || offersFor(l.slug, m).length) out.push({ url: abs(marketPath(m, `/lenses/${l.slug}`)) });
  }
  for (const [a, b] of indexedPairs()) out.push({ url: abs(`/compare/${pairSlug(a.item, b.item)}`) });
  out.push({ url: abs("/about") });
  return out;
}
