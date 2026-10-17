import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { crossCheck, readBrands, readCameraFiles, readMounts } from "../src/lib/catalog/load";
import { readCredits, thumbPath } from "../src/lib/images";

test("every catalog file parses and agrees with the rest of the catalog", () => {
  const { cameras, issues } = readCameraFiles();
  const all = [...issues, ...crossCheck(cameras, readBrands(), readMounts())];
  assert.deepEqual(all, []);
  assert.ok(cameras.length > 0);
});

test("every image credit has its thumbnail and every thumbnail its credit", () => {
  const credits = readCredits();
  const dir = path.join(process.cwd(), "public", "cameras");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".webp")).map((f) => f.replace(/\.webp$/, "")) : [];
  assert.deepEqual(Object.keys(credits).filter((s) => !fs.existsSync(thumbPath(s))), [], "credit without a file");
  assert.deepEqual(files.filter((s) => !credits[s]), [], "file without a credit");
});

test("thumbnails stay under the 150 KB image budget", () => {
  const dir = path.join(process.cwd(), "public", "cameras");
  if (!fs.existsSync(dir)) return;
  const big = fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).size > 150_000);
  assert.deepEqual(big, []);
});

test("credits point at cameras that exist", () => {
  const slugs = new Set(readCameraFiles().cameras.map((c) => c.slug));
  assert.deepEqual(Object.keys(readCredits()).filter((s) => !slugs.has(s)), []);
});

test("no two cameras share a photo", () => {
  const seen = new Map<string, string>();
  const dupes: string[] = [];
  for (const [slug, c] of Object.entries(readCredits())) {
    if (seen.has(c.file)) dupes.push(`${slug} and ${seen.get(c.file)}: ${c.file}`);
    seen.set(c.file, slug);
  }
  assert.deepEqual(dupes, []);
});
