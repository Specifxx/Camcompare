import { test } from "node:test";
import assert from "node:assert/strict";
import { marketReport } from "../src/lib/price-report";
import type { Offer } from "../src/lib/offers";

const o = (retailer: string, price: number, condition: Offer["condition"] = "new", extra: Partial<Offer> = {}): Offer =>
  ({ product: "x", kind: "camera", retailer, condition, price, currency: "USD", url: "https://example.com/", title: "t", seller: null, inStock: true, kit: false, mount: null, seenAt: "2026-11-01T00:00:00Z", sourceId: null, ...extra }) as Offer;

test("market report: new-price gap across retailers and the used saving", () => {
  const r = marketReport([
    [o("a", 800), o("b", 1000), o("c", 600, "used")],
    [o("a", 500), o("a", 450)],
    [o("b", 900, "new", { kit: true })],
    [o("c", 700, "new", { inStock: false })],
  ]);
  assert.equal(r.newPriced, 2);
  assert.equal(r.stores, 2);
  assert.equal(r.compared, 1);
  assert.ok(Math.abs((r.medianGap ?? 0) - 0.2) < 1e-9);
  assert.equal(r.usedCompared, 1);
  assert.ok(Math.abs((r.medianUsedSaving ?? 0) - 0.25) < 1e-9);
});

test("an empty market reports nothing, never zeros as findings", () => {
  const r = marketReport([]);
  assert.equal(r.medianGap, null);
  assert.equal(r.medianUsedSaving, null);
});
