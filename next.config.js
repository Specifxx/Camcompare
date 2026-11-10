const fs = require("node:fs");
const path = require("node:path");

// Products with no licensed thumbnail show a store's own listing photo
// (src/lib/store-photos.ts, data/store-photos.json): /products/<slug>.webp
// redirects to it on the store's CDN, so every place that uses the thumbnail
// path gets it and nothing is copied. Re-checked at every build: a product
// whose licensed file exists keeps it (redirects run before files).
function storePhotoRedirects() {
  const file = path.join(__dirname, "data", "store-photos.json");
  if (!fs.existsSync(file)) return [];
  let photos = {};
  try {
    photos = JSON.parse(fs.readFileSync(file, "utf8")).photos || {};
  } catch {
    return [];
  }
  return Object.entries(photos)
    .filter(([slug, p]) => /^[a-z0-9-]+$/.test(slug) && p && /^https:\/\//.test(p.src) && !fs.existsSync(path.join(__dirname, "public", "products", `${slug}.webp`)))
    .map(([slug, p]) => ({ source: `/products/${slug}.webp`, destination: p.src, permanent: false }));
}

/** @type {import('next').NextConfig} */
module.exports = {
  // Pages read data/ at build time; make sure the files ship with any
  // server-rendered route too. Not public/: the CDN serves it, and the
  // thumbnail check in lib/catalog would otherwise copy every
  // public/products/*.webp into every function.
  experimental: { outputFileTracingIncludes: { "/**": ["./data/**/*.json"] }, outputFileTracingExcludes: { "/**": ["./public/**"] } },
  // The old deployment address sends people and crawlers to the domain.
  async redirects() {
    // The bare domain is NOT redirected here (2026-10-26 outage): www lost its
    // DNS record and this rule sent every visitor to a host that did not
    // resolve. Vercel's domain settings decide; restore once www is valid.
    return [
      ...["camcompare.vercel.app"].map((host) => ({ source: "/:path*", has: [{ type: "host", value: host }], destination: "https://www.camcompare.app/:path*", permanent: true })),
      ...storePhotoRedirects(),
    ];
  },
  // Community threads and member pages are client-rendered over one static
  // shell each, so a new thread or member costs no build, ISR write or server
  // render (DECISIONS.md, 2026-10-17 "Community v1").
  async rewrites() {
    return [
      // IndexNow's standard key location, /<key>.txt at the root, beside /indexnow.txt (SEO audit, 2026-11-07: Bing
      // still says "Set up IndexNow" for www.camcompare.app although every daily submission answers 200). Both serve
      // the same key (src/lib/indexnow.ts).
      { source: "/e1b449a139464aa1985a25351882050f.txt", destination: "/indexnow.txt" },
      { source: "/community/t/:seg(\\d{1,18}(?:-[a-z0-9-]{1,80})?)", destination: "/community/t" },
      { source: "/u/:username([A-Za-z][A-Za-z0-9_]{2,19})", destination: "/u" },
      // Member stories, the same way (DECISIONS.md, "Member stories and My gear").
      { source: "/stories/p/:seg(\\d{1,18}(?:-[a-z0-9-]{1,80})?)", destination: "/stories/p" },
    ];
  },
  async headers() {
    // The JSON the pages fetch (quick views, price history, My gear values,
    // search): data, never a search result. Pages link none of it, but
    // crawlers find it through the scripts.
    const noindex = [{ key: "X-Robots-Tag", value: "noindex" }];
    return [
      { source: "/products/:file*.webp", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] },
      ...["/history/:path*", "/offers/:path*", "/prices/:path*", "/values/:path*", "/search-index.json"].map((source) => ({ source, headers: noindex })),
    ];
  },
};
