// Owner, 2026-11-18: eBay's pinned row may carry "Best price" when a NEW listing is genuinely the cheapest (not more than 25% under the best
// store, same currency); a used listing never; the store row then drops its tag. Source guard.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rows = readFileSync(new URL("../src/components/OfferRows.tsx", import.meta.url), "utf8");

test("only a new, in-stock listing under the best store, not a wrong product, qualifies", () => {
  assert.match(rows, /export const EBAY_MAX_UNDER_STORES = 0\.75;/);
  assert.match(rows, /\(listing\.cond \?\? "new"\) !== "new" \|\| listing\.condition !== "New"/, "used never");
  assert.match(rows, /best\.currency !== listing\.currency/);
  assert.match(rows, /listing\.price < best\.price && listing\.price >= best\.price \* EBAY_MAX_UNDER_STORES/);
});

test("the page and the quick view both use it, and the store row drops its tag", () => {
  const table = readFileSync(new URL("../src/components/OffersTable.tsx", import.meta.url), "utf8");
  const qv = readFileSync(new URL("../src/components/QuickView.tsx", import.meta.url), "utf8");
  assert.match(table, /const ebayBest = ebayBeatsBest\(listings\[0\], rows\);/);
  assert.match(table, /r\.tag = undefined/);
  assert.match(qv, /qvPins\(data, !!ebayBeatsBest\(data\.ebay\?\.listings\[0\], data\.rows\)\)/);
  assert.match(qv, /\{ \.\.\.r0, tag: undefined \}/);
});
