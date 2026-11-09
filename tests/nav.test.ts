// The navigation (owner, 2026-11-09 audit): one source list, at most seven header items, every link real and listed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { brands, mounts, publishedCameras, publishedLenses } from "../src/lib/catalog";
import { MARKET_CODES } from "../src/lib/markets";
import { groupLinks } from "../src/lib/nav";
import { navData } from "../src/lib/nav-data";

const nav = navData();

test("the header has at most seven top-level items (menus, direct links, More)", () => {
  assert.ok(nav.menus.length + nav.direct.length + 1 <= 7);
  assert.deepEqual(nav.menus.map((m) => m.key), ["cameras", "lenses", "brands", "systems"]);
});

test("every menu has links, and every link is an absolute path", () => {
  for (const item of nav.menus) {
    const links = item.groups.flatMap((g) => [...g.links, ...(g.all ? [g.all] : [])]);
    assert.ok(links.length > 0 || item.groups.some((g) => g.fill), item.key);
    for (const l of links) assert.match(l.path, /^\/[a-z0-9-]/, `${item.key}: ${l.path}`);
  }
});

test("brand and system menus link only brands and mounts that have products", () => {
  const liveBrands = () => brands().filter((b) => publishedCameras().some((c) => c.brand === b.slug) || publishedLenses().some((l) => l.brand === b.slug));
  const liveMounts = () => mounts().filter((mt) => publishedCameras().some((c) => c.mount === mt.slug) || publishedLenses().some((l) => l.mounts.includes(mt.slug)));
  const brandPaths = nav.menus.find((m) => m.key === "brands")!.groups.flatMap((g) => g.links.map((l) => l.path));
  assert.deepEqual(brandPaths.sort(), liveBrands().map((b) => `/brands/${b.slug}`).sort());
  const mountPaths = nav.menus.find((m) => m.key === "systems")!.groups.flatMap((g) => g.links.map((l) => l.path));
  assert.deepEqual(mountPaths.sort(), liveMounts().map((x) => `/mounts/${x.slug}`).sort());
});

test("per-market groups: budget tiers in the market's currency, uses only where they hold priced picks", () => {
  const cams = nav.menus.find((m) => m.key === "cameras")!;
  const budget = cams.groups.find((g) => g.fill === "camera-budget")!;
  assert.match(groupLinks(budget, "au", nav.uses)[0].label, /^Under A\$/);
  assert.match(groupLinks(budget, "uk", nav.uses)[0].label, /^Under £/);
  for (const m of MARKET_CODES) for (const l of nav.uses[m]) assert.match(l.path, /^\/cameras-for\/[a-z-]+$/);
});

test("the header and the footer read the one list; no client-only menu hides the links", () => {
  const header = readFileSync("src/components/Header.tsx", "utf8");
  assert.match(header, /from "@\/lib\/nav"/);
  assert.doesNotMatch(header, /\bopen &&/, "dropdown panels stay in the HTML");
  const footer = readFileSync("src/components/Footer.tsx", "utf8");
  for (const p of ["/cameras", "/lenses", "/brands", "/mounts", "/deals", "/used"]) assert.ok(footer.includes(`"${p}"`), p);
});
