/** @type {import('next').NextConfig} */
module.exports = {
  // Pages read data/ at build time; make sure the files ship with any
  // server-rendered route too. Not public/: the CDN serves it, and the
  // thumbnail check in lib/catalog would otherwise copy every
  // public/products/*.webp into every function.
  experimental: { outputFileTracingIncludes: { "/**": ["./data/**/*.json"] }, outputFileTracingExcludes: { "/**": ["./public/**"] } },
  // No image goes through Vercel's optimiser: thumbnails are pre-sized WebPs
  // (scripts/fetch-thumbnails.ts) served as static files. Belt and braces in
  // case a next/image creeps back: never optimise, and keep results 30 days.
  images: { unoptimized: true, minimumCacheTTL: 2592000, formats: ["image/webp"] },
  // The old deployment address sends people and crawlers to the domain.
  async redirects() {
    return [{ source: "/:path*", has: [{ type: "host", value: "camcompare.vercel.app" }], destination: "https://www.camcompare.app/:path*", permanent: true }];
  },
  // Community threads and member pages are client-rendered over one static
  // shell each, so a new thread or member costs no build, ISR write or server
  // render (DECISIONS.md, 2026-10-17 "Community v1").
  async rewrites() {
    return [
      { source: "/community/t/:id(\\d{1,18})", destination: "/community/t" },
      { source: "/u/:username([A-Za-z][A-Za-z0-9_]{2,19})", destination: "/u" },
    ];
  },
  async headers() {
    return [{ source: "/products/:file*.webp", headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }] }];
  },
};
