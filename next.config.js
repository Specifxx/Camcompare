/** @type {import('next').NextConfig} */
module.exports = {
  // Pages read data/ at build time; make sure the files ship with any
  // server-rendered route too. Not public/: the CDN serves it, and the
  // thumbnail check in lib/catalog would otherwise copy every
  // public/products/*.webp into every function.
  experimental: { outputFileTracingIncludes: { "/**": ["./data/**/*.json"] }, outputFileTracingExcludes: { "/**": ["./public/**"] } },
  // The old deployment address sends people and crawlers to the domain.
  async redirects() {
    return [{ source: "/:path*", has: [{ type: "host", value: "camcompare.vercel.app" }], destination: "https://www.camcompare.app/:path*", permanent: true }];
  },
  async headers() {
    return [{ source: "/products/:file*.webp", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] }];
  },
};
