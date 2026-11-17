import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Owner, 2026-11-17: affiliated (pinned) rows by price at the top, unpriced after them, then the stores.
test("PinnedMarkets orders its rows by price, unpriced last", () => {
  const s = readFileSync(new URL("../src/components/OfferRows.tsx", import.meta.url), "utf8");
  assert.match(s, /const ordered = \[\.\.\.links\.filter\(\(l\) => cents\(l\) !== null\)\.sort/);
  assert.match(s, /\{ordered\.map\(\(l\) =>/);
});
