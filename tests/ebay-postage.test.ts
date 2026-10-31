// eBay offers carry their postage (visitor feedback on WargameCompare, 2026-10-31): a listing whose postage eBay does
// not state is never an offer, and an offer's price is item + postage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { statedPostage } from "../src/lib/sources/ebay";

test("postage: free, a stated cost, or nothing when eBay states none or another currency", () => {
  assert.equal(statedPostage({ shippingOptions: [{ shippingCost: { value: "0.00", currency: "USD" } }] }, "USD"), 0);
  assert.equal(statedPostage({ shippingOptions: [{ shippingCost: { value: "12.50", currency: "AUD" } }] }, "AUD"), 1250);
  assert.equal(statedPostage({ shippingOptions: [{ shippingCost: { value: "12.50" } }] }, "AUD"), 1250);
  assert.equal(statedPostage({ shippingOptions: [{}] }, "USD"), null, "calculated");
  assert.equal(statedPostage({}, "USD"), null, "no shipping option");
  assert.equal(statedPostage({ shippingOptions: [{ shippingCost: { value: "9.00", currency: "USD" } }] }, "GBP"), null, "another currency");
  assert.equal(statedPostage({ shippingOptions: [{ shippingCost: { value: "-3", currency: "USD" } }] }, "USD"), null);
});
