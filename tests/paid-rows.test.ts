// Owner, 2026-11-12: only eBay and TCGplayer are paid rows at the top; Amazon shows only with a real price. Source guard.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("no Amazon search-link row or Also-check link: Amazon is pinned only with its price", () => {
  const rows = readFileSync(new URL("../src/lib/offer-rows.ts", import.meta.url), "utf8");
  assert.doesNotMatch(rows, /See it on Amazon/);
  const table = readFileSync(new URL("../src/components/OffersTable.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(table, /Check Amazon|Also check on Amazon/);
});
