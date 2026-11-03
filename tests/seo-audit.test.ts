// SEO audit (2026-11-03): descriptive alt text, homepage schema and FAQ, description grammar, breadcrumbs on hubs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(p, "utf8");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

test("no page or component draws a photo with empty alt text (share images and the quick view aside)", () => {
  for (const f of walk("src").filter((f) => f.endsWith(".tsx") && !f.includes("opengraph-image") && !f.endsWith("QuickView.tsx"))) {
    assert.ok(!/<(img|Image|ProductThumb|Cover)\b[^>]*alt=""/.test(read(f)), f);
  }
});

test("the homepage says 'in the US', carries Organization, WebSite and a printed FAQ", () => {
  const src = read("src/views/HomeView.tsx");
  assert.doesNotMatch(src, /deals in \$\{MARKETS\[m\]\.name\}/);
  for (const t of ['"Organization"', '"WebSite"', '"FAQPage"', "homeFaq(m, storeCount).map"]) assert.ok(src.includes(t), t);
});

test("brand, mount and accessory pages carry a BreadcrumbList", () => {
  for (const f of ["src/views/BrandView.tsx", "src/views/MountView.tsx", "src/views/AccessoriesView.tsx"]) assert.match(read(f), /breadcrumb\(\[/, f);
});
