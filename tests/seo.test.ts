import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import type { Metadata } from "next";
import { offersFor, product, publishedCameras, publishedLenses } from "../src/lib/catalog";
import { isMarket, MARKET_CODES, type MarketCode } from "../src/lib/markets";
import { overview, overviewText } from "../src/lib/overview";
import { catalogIndex, relatedFor } from "../src/lib/related";
import { abs } from "../src/lib/site";

// The views and the sitemap import components with JSX at module level.
(globalThis as { React?: unknown }).React = React;
const load = async () => ({
  sitemap: (await import("../src/app/sitemap")).default,
  camera: await import("../src/views/CameraView"),
  lens: await import("../src/views/LensView"),
  brand: await import("../src/views/BrandView"),
  mount: await import("../src/views/MountView"),
  browse: await import("../src/views/BrowseView"),
  home: await import("../src/views/HomeView"),
  finder: await import("../src/views/FinderView"),
});

/** The metadata of a sitemap path we can resolve without rendering, or undefined. */
async function metaFor(path: string): Promise<Metadata | undefined> {
  const v = await load();
  const [, first, ...rest] = path.split("/");
  const m: MarketCode = isMarket(first) && first !== "us" ? first : "us";
  const parts = m === "us" ? [first, ...rest] : rest;
  const [section, slug] = parts;
  if (!section) return v.home.homeMetadata(m);
  if (section === "cameras") return slug ? v.camera.cameraMetadata(slug, m) : v.browse.browseMetadata("camera", m);
  if (section === "lenses") return slug ? v.lens.lensMetadata(slug, m) : v.browse.browseMetadata("lens", m);
  if (section === "brands") return slug ? v.brand.brandMetadata(slug, m) : v.brand.brandsMetadata(m);
  if (section === "mounts") return slug ? v.mount.mountMetadata(slug, m) : v.mount.mountsMetadata(m);
  if (section === "finder") return v.finder.finderMetadata(m);
  return undefined;
}

const noindex = (md: Metadata) => typeof md.robots === "object" && md.robots !== null && "index" in md.robots && md.robots.index === false;

test("every sitemap URL is indexable, self-canonical, and its hreflang points only at sitemap URLs", async () => {
  const { sitemap } = await load();
  const urls = sitemap().map((e) => e.url);
  const set = new Set(urls);
  assert.equal(set.size, urls.length, "no URL twice");
  let checked = 0;
  for (const u of urls) {
    assert.ok(u.startsWith(abs("/")), u);
    const { pathname: path, search } = new URL(u);
    assert.equal(search, "", u);
    assert.ok(path === "/" || !path.endsWith("/"), `no query or trailing slash: ${path}`);
    const bare = path.replace(/^\/(uk|eu|au|sg)(?=\/|$)/, "") || "/";
    assert.ok(!/^\/(compare|saved|board|feedback|admin|alerts|stories\/new)(\/|$)/.test(bare) || /^\/compare\/.+-vs-.+/.test(bare), `builder or private page in sitemap: ${path}`);
    const md = await metaFor(path);
    if (!md) continue;
    checked++;
    assert.ok(!noindex(md), `noindex page in sitemap: ${path}`);
    assert.equal(md.alternates?.canonical, path, `canonical of ${path}`);
    for (const href of Object.values(md.alternates?.languages ?? {})) assert.ok(set.has(abs(String(href))), `hreflang ${href} from ${path} is not in the sitemap`);
  }
  assert.ok(checked > 1000, `resolved ${checked}`);
});

test("a market's page of a product it doesn't list is noindex, out of the sitemap and out of hreflang", async () => {
  const v = await load();
  const urls = new Set(v.sitemap().map((e) => e.url));
  for (const m of MARKET_CODES.filter((x) => x !== "us")) {
    const c = publishedCameras().find((x) => !offersFor(x.slug, m).length);
    if (!c) continue;
    const md = v.camera.cameraMetadata(c.slug, m);
    assert.ok(noindex(md), `${m} ${c.slug}`);
    assert.ok(!urls.has(abs(`/${m}/cameras/${c.slug}`)));
    const us = v.camera.cameraMetadata(c.slug, "us");
    assert.ok(!Object.values(us.alternates?.languages ?? {}).includes(`/${m}/cameras/${c.slug}`));
  }
});

test("related blocks: same kind, never the product itself, no product twice on a page", () => {
  for (const slug of ["sony-a7-iv", "canon-eos-r50", "fujifilm-x100vi", "sony-fe-24-70mm-f2-8-gm-ii", "tamron-16-50mm-f2-8-a"]) {
    const self = product(slug);
    if (!self) continue;
    const r = relatedFor(self);
    const all = [...r.more.map((x) => x.p), ...r.alternatives, ...r.sameBrand, ...(r.sameMount?.list ?? [])];
    const slugs = all.map((p) => p.item.slug);
    assert.equal(new Set(slugs).size, slugs.length, `${slug}: ${slugs.join(",")}`);
    assert.ok(!slugs.includes(slug));
    assert.ok(all.every((p) => p.kind === self.kind));
    assert.ok(r.sameBrand.every((p) => p.item.brand === self.item.brand));
    assert.ok(r.alternatives.length > 0, `${slug} has alternatives`);
  }
  const a7 = product("sony-a7-iv");
  if (a7?.kind === "camera") for (const p of relatedFor(a7).alternatives) assert.equal(p.kind === "camera" && p.item.specs.sensorFormat, "full-frame");
});

test("the /cameras and /lenses A-Z index links every published product once", () => {
  for (const [kind, list] of [["camera", publishedCameras()], ["lens", publishedLenses()]] as const) {
    const linked = catalogIndex(kind).flatMap((g) => g.items.map((p) => p.slug));
    assert.equal(linked.length, list.length);
    assert.deepEqual(new Set(linked), new Set(list.map((p) => p.slug)));
  }
});

test("the overview prices in the market's own currency only, and names where else an unlisted product is sold", () => {
  const self = product("sony-a7-iv")!;
  for (const m of MARKET_CODES) {
    const text = overviewText(overview({ self, m, name: "Sony α7 IV", goodFor: [], notFor: [], history: [], launch: null, alternatives: [] }));
    assert.match(text, /^The Sony α7 IV is a 33 MP full-frame mirrorless camera for Sony E-mount/);
    const shown = new Set<MarketCode>();
    if (/(?<![AS])\$\d/.test(text)) shown.add("us");
    if (/£\d/.test(text)) shown.add("uk");
    if (/€\d/.test(text)) shown.add("eu");
    if (/A\$\d/.test(text)) shown.add("au");
    if (/S\$\d/.test(text)) shown.add("sg");
    assert.ok([...shown].every((x) => x === m), `${m} overview shows ${[...shown]} prices: ${text}`);
  }
  const unlisted = MARKET_CODES.flatMap((m) => publishedLenses().filter((l) => !offersFor(l.slug, m).length && MARKET_CODES.some((x) => offersFor(l.slug, x).length)).map((l) => [m, l] as const))[0];
  if (unlisted) {
    const [m, l] = unlisted;
    const o = overview({ self: product(l.slug)!, m, name: l.name, goodFor: [], notFor: [], history: [], launch: null, alternatives: [] });
    const text = overviewText(o);
    assert.match(text, /No store we track .* lists it today\. It is listed in /);
    const links = o.flat().filter((s): s is { text: string; href: string } => typeof s !== "string").map((s) => s.href);
    assert.ok(links.some((h) => h.endsWith(`/lenses/${l.slug}`)));
  }
});
