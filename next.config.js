/** @type {import('next').NextConfig} */
module.exports = {
  // Pages read data/ at build time; make sure the files ship with any
  // server-rendered route too.
  experimental: { outputFileTracingIncludes: { "/**": ["./data/**/*.json"] } },
  async headers() {
    return [{ source: "/products/:file*.webp", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] }];
  },
};
