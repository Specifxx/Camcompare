// The one in-page ad block and the phone dock (DECISIONS.md, 2026-11-13 "the side rails are replaced by one native horizontal block").
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { DOCK_ARM, dockShows, type DockState } from "../src/components/AdDock";
import { dockHref, MIN_WIDTH } from "../src/components/PhoneDock";
import { blockTiles, BLOCK_TILES } from "../src/components/InlineAds";
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
      assert.match(t.href, new RegExp(`customid=cc-${m}-inline-ebay`));
    }
    if (m === "sg") assert.equal(r.amazon, null, "no Associates tag in Singapore");
    for (const t of r.amazon?.tiles ?? []) {
      assert.equal(t.price, null, "never an Amazon price in a rail");
      assert.match(t.href, new RegExp(`[?&]tag=[a-z0-9-]+&ascsubtag=cc-${m}-inline-amazon|ascsubtag=cc-${m}-inline-amazon`));
      assert.match(t.href, /\/dp\/[A-Z0-9]{10}\?|\/s\?k=/, "a specific product: its ASIN or its exact name");
    }
  }
});

test("block: six tiles, eBay first then Amazon, Amazon never priced", () => {
  const t = (id: string, price: string | null) => ({ id, name: id, img: "x", price, href: "h" });
  const ebay = { label: "eBay", tiles: ["a", "b", "c", "d", "e", "f", "g"].map((i) => t(i, "$1")) };
  const withAmazon = blockTiles({ ebay, amazon: { label: "Amazon", tiles: ["x", "y", "z"].map((i) => t(i, null)) } });
  assert.equal(withAmazon.length, BLOCK_TILES);
  assert.deepEqual(withAmazon.map((b) => b.source), ["ebay", "ebay", "ebay", "ebay", "amazon", "amazon"]);
  assert.ok(withAmazon.filter((b) => b.source === "amazon").every((b) => b.price === null));
  const noAmazon = blockTiles({ ebay, amazon: null });
  assert.equal(noAmazon.length, BLOCK_TILES);
  assert.ok(noAmazon.every((b) => b.source === "ebay"));
});

test("block: in the page, browser only, native, one per page, no side rails left", () => {
  const route = read("src/app/rails/[market]/route.ts");
  assert.match(route, /export const dynamic = "force-static"/);
  assert.match(route, /export const dynamicParams = false/);
  const c = read("src/components/InlineAds.tsx");
  assert.match(c, /^"use client";/);
  assert.match(read("src/components/useAdFeed.ts"), /fetch\(`\/rails\/\$\{market\}`\)/);
  assert.match(c, />Ad</);
  assert.match(c, /OutboundLink/, "every link rel sponsored, measured");
  assert.match(c, /min-h-\[/, "height reserved: CLS 0");
  assert.doesNotMatch(c.replace(/^\/\/.*$/gm, ""), /fixed|sticky|absolute inset-x|z-\d/, "nothing floating");
  assert.equal(MIN_WIDTH, 1280);
  for (const gone of ["src/components/SideRails.tsx", "src/components/ebay/EbayPromo.tsx", "src/components/home/EbayStrip.tsx"]) {
    assert.ok(!existsSync(new URL(`../${gone}`, import.meta.url)), `${gone} is gone: one block, not two`);
  }
  assert.doesNotMatch(read("src/app/globals.css"), /calc\(100vw - 320px\)/, "the column keeps its whole width");
  assert.match(read("src/app/layout.tsx"), /<PhoneDock \/>/);
  assert.doesNotMatch(read("src/app/layout.tsx"), /<InlineAds/, "never in the layout: each page places its one block");
  // The AdSense rules still hold: AdOrPromo is the one position, AdSlot when the owner turns it on, else the block.
  const pos = read("src/components/ebay/AdOrPromo.tsx");
  assert.match(pos, /if \(adsenseOn\(slot\)\) return <AdSlot slot=\{slot\} \/>;/);
  assert.match(pos, /return <InlineAds \/>;/);
  const count = (f: string) => (read(f).match(/<(?:AdOrPromo|InlineAds|AdSlot)\b/g) ?? []).length;
  for (const f of ["CameraView", "LensView", "BrowseView", "DealsView", "HomeView"]) assert.equal(count(`src/views/${f}.tsx`), 1, `${f}: one ad block`);
  assert.equal(count("src/views/AccessoriesView.tsx"), 2, "the accessories index and its category pages: one each");
  assert.doesNotMatch(read("src/components/QuickView.tsx"), /InlineAds|AdOrPromo/, "never in the quick view");
  const cam = read("src/views/CameraView.tsx");
  assert.ok(cam.indexOf("<AdOrPromo") > cam.indexOf("<CameraAccessories"), "below the product's content");
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
  assert.equal(dockHref("https://www.ebay.com/itm/1?customid=cc-us-inline-ebay&x=1"), "https://www.ebay.com/itm/1?customid=cc-us-dock-ebay&x=1");
  const d = read("src/components/AdDock.tsx");
  assert.match(d, /return armed \? <>\{children\}<\/> : null;/);
  assert.match(d, /translate-y-full/);
  assert.doesNotMatch(d.replace(/^\/\/.*$/gm, ""), /amazon/i);
  assert.doesNotMatch(read("src/components/PhoneDock.tsx").replace(/^\/\/.*$/gm, ""), /amazon/i, "no Amazon link in an overlay");
  for (const v of ["CameraView", "LensView"]) assert.match(read(`src/views/${v}.tsx`), /data-no-dock/, "never on a product page");
});
