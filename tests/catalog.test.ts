import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { crossCheck, readBrands, readCameraFiles, readLensFiles, readMounts, validGtin } from "../src/lib/catalog/load";
import { cameraSchema } from "../src/lib/catalog/schema";
import { photoKeys, readCredits, thumbPath, THUMB_MAX_BYTES } from "../src/lib/images";
import { cam, lensFix } from "./fixtures";

const PRODUCTS = path.join(process.cwd(), "public", "products");

test("every catalog file parses and agrees with the rest of the catalog", () => {
  const { cameras, issues } = readCameraFiles();
  const { lenses, issues: lensIssues } = readLensFiles();
  const all = [...issues, ...lensIssues, ...crossCheck(cameras, readBrands(), readMounts(), lenses)];
  assert.deepEqual(all, []);
  assert.ok(cameras.length > 0 && lenses.length > 0);
});

test("every image credit has its thumbnail and every thumbnail its credit", () => {
  const credits = readCredits();
  const files = fs.existsSync(PRODUCTS) ? fs.readdirSync(PRODUCTS).filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5)) : [];
  assert.deepEqual(Object.keys(credits).filter((s) => !fs.existsSync(thumbPath(s))), [], "credit without a file");
  assert.deepEqual(files.filter((s) => !credits[s]), [], "file without a credit");
});

test("thumbnails stay under the 150 KB image budget", () => {
  if (!fs.existsSync(PRODUCTS)) return;
  const big = fs.readdirSync(PRODUCTS).filter((f) => fs.statSync(path.join(PRODUCTS, f)).size > THUMB_MAX_BYTES);
  assert.deepEqual(big, []);
});

test("credits point at products that exist", () => {
  const slugs = new Set([...readCameraFiles().cameras, ...readLensFiles().lenses].map((p) => p.slug));
  assert.deepEqual(Object.keys(readCredits()).filter((s) => !slugs.has(s)), []);
});

test("no two products share a photo", () => {
  // By photo: one Flickr shot can be credited under a Commons title and a Flickr URL.
  const seen = new Map<string, string>();
  const dupes = new Set<string>();
  for (const [slug, c] of Object.entries(readCredits())) {
    for (const k of new Set([...photoKeys(c.file), ...photoKeys(c.pageUrl)])) {
      const other = seen.get(k);
      if (other && other !== slug) dupes.add(`${slug} and ${other}: ${c.file}`);
      seen.set(k, slug);
    }
  }
  assert.deepEqual([...dupes], []);
});

test("a Flickr photo is known by its id under any of its names", () => {
  const id = (s: string) => photoKeys(s).find((k) => k.startsWith("flickr:"));
  assert.equal(id("Canon EOS R6 Mark II - by Henry Söderlund (52546794891).jpg"), "flickr:52546794891");
  assert.equal(id("Canon EOS R6 Mark II (52546794891, cropped).jpg"), "flickr:52546794891");
  assert.equal(id("Canon RF 24-50mm F4.5-6.3 IS STM (52853984559) (1-1 cropped).jpg"), "flickr:52853984559");
  assert.equal(id("https://live.staticflickr.com/65535/52546794891_0a1b2c3d4e_b.jpg"), "flickr:52546794891");
  assert.equal(id("https://www.flickr.com/photos/12345678@N02/52546794891"), "flickr:52546794891");
  // A timestamp or a Mapillary id is not a Flickr id.
  assert.equal(id("Drama actress recording with DJI Osmo Pocket 3 (20250601181220).jpg"), undefined);
  assert.equal(id("Mapillary (rempshaener) 2024-08-11 (841228751451029 at abONAw2gk4WHFRuTCPomrc with GoPro HERO11 Black).jpg"), undefined);
});

test("a GTIN belongs to one product and has a valid check digit", () => {
  assert.ok(validGtin("027242923577") && validGtin("4549292157253") && validGtin("96385074"));
  assert.ok(!validGtin("027242923578") && !validGtin("1234567890"));
  const a = cam("sony-a7-iv", "sony", ["a7 IV"], { gtins: ["027242923577"] });
  const b = cam("sony-a7-v", "sony", ["a7 V"], { gtins: ["0027242923577"] }); // the same GTIN, padded
  const brands = [{ slug: "sony", name: "Sony", country: "JP", site: "https://sony.com" }];
  const mounts = [{ slug: "sony-e", name: "Sony E", brand: "sony", flangeMm: 18, formats: ["full-frame" as const], introduced: 2010, status: "current" as const }];
  assert.deepEqual(crossCheck([a, b], brands, mounts).map((i) => i.message), ["GTIN 0027242923577 also belongs to sony-a7-iv"]);
  const l = lensFix("sony-fe-50mm", "sony", ["FE 50mm"], { gtins: ["027242923578"] });
  assert.deepEqual(crossCheck([a], brands, mounts, [l]).map((i) => i.message), ["GTIN 027242923578 has a wrong check digit"]);
});

test("an announcement date must be a real day", () => {
  const ok = (announced: string) => cameraSchema.safeParse({ ...cam("sony-x", "sony", ["Sony X"]), announced }).success;
  assert.ok(ok("2024-02-29"));
  assert.ok(!ok("2024-02-30") && !ok("2023-02-29") && !ok("2023-13-01") && !ok("2023-1-01"));
});

test("every offer and history file parses", async () => {
  const { MARKET_CODES } = await import("../src/lib/markets");
  const { readOffersFile, readHistory } = await import("../src/lib/offers");
  for (const m of MARKET_CODES) {
    const f = readOffersFile(m);
    assert.equal(f.market, m);
    for (const o of f.offers) assert.equal(o.currency, f.currency, `${m}: offer ${o.retailer}/${o.product} in ${o.currency}`);
    readHistory(m);
  }
});
