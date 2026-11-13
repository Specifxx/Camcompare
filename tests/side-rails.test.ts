// The side rails and the phone dock (DECISIONS.md, 2026-11-06 "Side rails: eBay left, Amazon right, and the phone dock").
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DOCK_ARM, dockShows, type DockState } from "../src/components/AdDock";
import { dockHref, MIN_WIDTH } from "../src/components/SideRails";
import { railsFor } from "../src/lib/side-rails";
import { MARKET_CODES } from "../src/lib/markets";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("rails: eBay tiles are the import's own listings; Amazon tiles are tagged links with no price", () => {
  for (const m of MARKET_CODES) {
    const r = railsFor(m);
    assert.ok(r.ebay.tiles.length <= 10);
    for (const t of r.ebay.tiles) {
      assert.ok(t.img && t.price, `${m}: a photo and a price`);
      assert.match(t.href, /campid=5339155912/);
      assert.match(t.href, new RegExp(`customid=cc-${m}-side-ebay`));
    }
    if (m === "sg") assert.equal(r.amazon, null, "no Associates tag in Singapore");
    for (const t of r.amazon?.tiles ?? []) {
      assert.equal(t.price, null, "never an Amazon price in a rail");
      assert.match(t.href, new RegExp(`[?&]tag=[a-z0-9-]+&ascsubtag=cc-${m}-side-amazon|ascsubtag=cc-${m}-side-amazon`));
      assert.match(t.href, /\/dp\/[A-Z0-9]{10}\?|\/s\?k=/, "a specific product: its ASIN or its exact name");
    }
  }
});

test("rails: browser only, a static file per market, the page's column narrowed by CSS from 1280px", () => {
  const route = read("src/app/rails/[market]/route.ts");
  assert.match(route, /export const dynamic = "force-static"/);
  assert.match(route, /export const dynamicParams = false/);
  const c = read("src/components/SideRails.tsx");
  assert.match(c, /^"use client";/);
  assert.match(c, /fetch\(`\/rails\/\$\{region\}`\)/);
  assert.match(c, />Ad</);
  assert.equal(MIN_WIDTH, 1280);
  assert.doesNotMatch(read("src/app/globals.css"), /calc\(100vw - 320px\)/, "no side rails (owner, 2026-11-13): the column keeps its whole width");
  assert.match(read("src/app/layout.tsx"), /<SideRails \/>/);
});

test("the phone dock: narrow screens only, after a scroll, never beside another unit, a product page or a dialog; never Amazon", () => {
  const ok: DockState = { narrow: true, scrolled: 1000, screen: 800, blockers: 0, buybar: false, modal: false, typing: false, dismissed: false };
  assert.ok(dockShows(ok));
  assert.ok(!dockShows({ ...ok, narrow: false }));
  assert.ok(!dockShows({ ...ok, scrolled: 800 * DOCK_ARM - 1 }));
  assert.ok(!dockShows({ ...ok, blockers: 1 }));
  assert.ok(!dockShows({ ...ok, buybar: true }));
  assert.ok(!dockShows({ ...ok, modal: true }));
  assert.ok(!dockShows({ ...ok, typing: true }));
  assert.ok(!dockShows({ ...ok, dismissed: true }));
  assert.equal(dockHref("https://www.ebay.com/itm/1?customid=cc-us-side-ebay&x=1"), "https://www.ebay.com/itm/1?customid=cc-us-dock-ebay&x=1");
  const d = read("src/components/AdDock.tsx");
  assert.match(d, /return armed \? <>\{children\}<\/> : null;/);
  assert.match(d, /translate-y-full/);
  assert.doesNotMatch(d.replace(/^\/\/.*$/gm, ""), /amazon/i);
  assert.doesNotMatch(read("src/components/SideRails.tsx").split("export function dockHref")[1], /amazon/i, "no Amazon link in an overlay");
  for (const v of ["CameraView", "LensView"]) assert.match(read(`src/views/${v}.tsx`), /data-no-dock/, "never on a product page");
});
