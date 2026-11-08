import { USE_INDEX_MIN, USE_KEYS, picksForUse } from "@/components/curated/UseView";
import { WORLD_LINES, worldTable } from "@/lib/world";
import type { MetadataRoute } from "next";
import { indexedPairs, offersGeneratedAt, pairSlug, publishedCameras, publishedLenses } from "@/lib/catalog";
import { productIndexable } from "@/lib/indexing";
import { MARKET_CODES, marketPath } from "@/lib/markets";
import { guides } from "@/lib/guides";
import { abs } from "@/lib/site";
import { BOARDS } from "@/lib/community/rules";
import { digicams, gadgets, GADGET_PAGES, pricedIn, viralCameras } from "@/lib/curated";
import { releasesIndexable } from "@/components/releases/ReleasesView";
import { categorySummaries } from "@/lib/accessory-rows";
import { liveBrands } from "@/views/BrandView";
import { dealsIndexable } from "@/views/DealsView";
import { usedIndexable } from "@/views/UsedView";
import { liveMounts } from "@/views/MountView";

// Only pages that are indexed: every US product page, and a market's product
// page once three stores there list it (lib/indexing.ts, the same rule as the noindex).
// Deals pages once they have deals (dealsIndexable).
export default function sitemap(): MetadataRoute.Sitemap {
  const out: MetadataRoute.Sitemap = [];
  for (const m of MARKET_CODES) {
    for (const p of ["/", "/cameras", "/lenses", "/finder", "/brands", "/mounts"]) out.push({ url: abs(marketPath(m, p)) });
    // The deals and sale pages are rebuilt from each import's offers, so that import's time is their real lastmod.
    const priced = offersGeneratedAt(m) || undefined;
    if (dealsIndexable(m)) out.push(...["/deals", "/black-friday", "/cyber-monday", "/boxing-day", "/january-sales", "/lunar-new-year"].map((p) => ({ url: abs(marketPath(m, p)), lastModified: priced })));
    if (usedIndexable(m)) out.push({ url: abs(marketPath(m, "/used")) });
    if (releasesIndexable(m)) out.push({ url: abs(marketPath(m, "/releases")) });
    if (pricedIn(digicams(), m)) out.push({ url: abs(marketPath(m, "/digicams")) });
    // Cameras by use (components/curated/UseView.tsx): a page once it has USE_INDEX_MIN priced picks in the market.
    for (const use of USE_KEYS) if (picksForUse(use, m).top.length >= USE_INDEX_MIN) out.push({ url: abs(marketPath(m, `/cameras-for/${use}`)) });
    if (pricedIn(viralCameras().map((v) => v.camera), m)) out.push({ url: abs(marketPath(m, "/viral-cameras")) });
    for (const t of ["drone", "smart-glasses"] as const) if (gadgets(t).length && pricedIn(gadgets(t), m)) out.push({ url: abs(marketPath(m, GADGET_PAGES[t].path)) });
    const acc = categorySummaries(m); // accessory pages only where that market has listings
    if (acc.length) out.push({ url: abs(marketPath(m, "/accessories")) }, ...acc.map((s) => ({ url: abs(marketPath(m, `/accessories/${s.slug}`)) })));
    for (const b of liveBrands()) out.push({ url: abs(marketPath(m, `/brands/${b.slug}`)) });
    for (const mt of liveMounts()) out.push({ url: abs(marketPath(m, `/mounts/${mt.slug}`)) });
    for (const c of publishedCameras()) if (productIndexable(c.slug, m)) out.push({ url: abs(marketPath(m, `/cameras/${c.slug}`)) });
    for (const l of publishedLenses()) if (productIndexable(l.slug, m)) out.push({ url: abs(marketPath(m, `/lenses/${l.slug}`)) });
  }
  for (const [a, b] of indexedPairs()) out.push({ url: abs(`/compare/${pairSlug(a.item, b.item)}`) });
  out.push({ url: abs("/guides") }, ...guides().map((g) => ({ url: abs(`/guides/${g.slug}`), lastModified: g.updated || undefined })));
  out.push({ url: abs("/about") }, { url: abs("/creators") }, { url: abs("/contact") }, { url: abs("/how-we-pick-stores") }, { url: abs("/list-your-store") }, { url: abs("/widgets") }, { url: abs("/is-this-a-good-price") }, { url: abs("/price-report") });
  // Only /world tables with something priced (the rest are noindex).
  const pricedLines = WORLD_LINES.filter((l) => worldTable(l).priced > 0);
  out.push({ url: abs("/world") }, ...[...new Set(pricedLines.map((l) => l.brand))].map((b) => ({ url: abs(`/world/${b}`) })), ...pricedLines.map((l) => ({ url: abs(`/world/${l.brand}/${l.slug}`) })));
  out.push({ url: abs("/community") }, ...BOARDS.map((b) => ({ url: abs(`/community/${b.slug}`) })));
  out.push({ url: abs("/stories") }, { url: abs("/requests") }, { url: abs("/collection") });
  return out;
}
