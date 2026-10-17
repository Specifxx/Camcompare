import type { MetadataRoute } from "next";
import { brands, comparePairs, pairSlug, publishedCameras } from "@/lib/catalog";
import { abs } from "@/lib/site";


export default function sitemap(): MetadataRoute.Sitemap {
  const cams = publishedCameras();
  const live = new Set(cams.map((c) => c.brand));
  return [
    { url: abs("/") },
    { url: abs("/cameras") },
    { url: abs("/brands") },
    ...brands().filter((b) => live.has(b.slug)).map((b) => ({ url: abs(`/brands/${b.slug}`) })),
    ...cams.map((c) => ({ url: abs(`/cameras/${c.slug}`) })),
    ...comparePairs().map(([a, b]) => ({ url: abs(`/compare/${pairSlug(a, b)}`) })),
    { url: abs("/about") },
  ];
}
