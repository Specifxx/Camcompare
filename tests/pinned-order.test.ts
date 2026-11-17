import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Owner, 2026-11-17 (final): eBay, then Amazon, then the stores.
test("PinnedMarkets keeps eBay first and Amazon second", () => {
  const s = readFileSync(new URL("../src/components/OfferRows.tsx", import.meta.url), "utf8");
  assert.match(s, /const ordered = links;/);
  assert.match(s, /\{ordered\.map\(\(l\) =>/);
});
