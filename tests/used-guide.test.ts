import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { MARKET_CODES, marketPath } from "../src/lib/markets";
import { abs } from "../src/lib/site";

// The views and the sitemap import components with JSX at module level (as in seo.test.ts).
(globalThis as { React?: unknown }).React = React;
const load = async () => ({ sitemap: (await import("../src/app/sitemap")).default, ...(await import("../src/views/UsedView")) });

test("the used guide lists only products with a typical used price, most-listed first", async () => {
  const { usedRows } = await load();
  for (const m of MARKET_CODES) {
    const { cameras, lenses } = usedRows(m);
    for (const rows of [cameras, lenses]) {
      for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].v.listings >= rows[i].v.listings, `${m}: sorted by listings`);
      for (const r of rows) assert.ok(r.v.low <= r.v.value && r.v.value <= r.v.high, `${m} ${r.p.item.slug}: range holds the typical price`);
    }
    assert.ok(cameras.every((r) => r.p.kind === "camera") && lenses.every((r) => r.p.kind === "lens"));
  }
});

test("a market's used guide is in the sitemap only when it is indexable (ten or more products)", async () => {
  const { sitemap, USED_MIN_ROWS, usedIndexable, usedRows } = await load();
  const urls = new Set(sitemap().map((e) => e.url));
  for (const m of MARKET_CODES) {
    const r = usedRows(m);
    assert.equal(usedIndexable(m), r.cameras.length + r.lenses.length >= USED_MIN_ROWS);
    assert.equal(urls.has(abs(marketPath(m, "/used"))), usedIndexable(m), m);
  }
});

test("the guide's eBay links are tagged used searches with a Paid link note", () => {
  const src = readFileSync("src/views/UsedView.tsx", "utf8");
  assert.match(src, /ebayLink\(m, \{ query: retailerQuery\(p, m\), condition: "used" \}, `used-\$\{m\}`, "used-ebay"/);
  assert.match(src, /<EbayText /, "EbayText carries the Paid link tag");
});
