import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { crossCheck, readBrands, readCameraFiles, readLensFiles, readMounts } from "../src/lib/catalog/load";
import { readCredits, thumbPath, THUMB_MAX_BYTES } from "../src/lib/images";

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
  const seen = new Map<string, string>();
  const dupes: string[] = [];
  for (const [slug, c] of Object.entries(readCredits())) {
    if (seen.has(c.file)) dupes.push(`${slug} and ${seen.get(c.file)}: ${c.file}`);
    seen.set(c.file, slug);
  }
  assert.deepEqual(dupes, []);
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
