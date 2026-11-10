// The paid alternative under the hero's best price (lib/paid-alternative.ts, 2026-11-10).
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { PAID_ALTERNATIVE_BAND, paidAlternative } from "../src/lib/paid-alternative";
import type { Offer } from "../src/lib/offers";

const o = (retailer: string, price: number, x: Partial<Offer> = {}) => ({ retailer, price, currency: "USD", condition: "new", inStock: true, kit: false, url: `https://x/${retailer}`, product: "p", ...x }) as unknown as Offer;
const PAYS = new Set(["ebay", "amazon"]);
const pays = (x: Offer) => PAYS.has(x.retailer);

test("names the cheapest paid offer of the same kind within 20% when the best one pays nothing", () => {
  const best = o("shop", 1000);
  const alt = paidAlternative({ offer: best, what: "new" }, [best, o("amazon", 1150), o("ebay", 1100)], pays);
  assert.equal(alt?.offer.retailer, "ebay");
  assert.equal(alt?.pctMore, 10);
  assert.equal(PAID_ALTERNATIVE_BAND, 1.2);
});

test("never another kind: used for new, a kit for a body, out of stock or another currency", () => {
  const best = o("shop", 1000);
  const w = (x: Offer) => paidAlternative({ offer: best, what: "new" }, [best, x], pays);
  assert.equal(w(o("ebay", 1050, { condition: "used" })), null);
  assert.equal(w(o("ebay", 1050, { kit: true })), null);
  assert.equal(w(o("ebay", 1050, { inStock: false })), null);
  assert.equal(w(o("ebay", 1050, { currency: "GBP" } as Partial<Offer>)), null);
  assert.equal(w(o("ebay", 1201)), null, "over 20% more");
});

test("nothing when the best offer already pays", () => {
  const best = o("amazon", 1000);
  assert.equal(paidAlternative({ offer: best, what: "new" }, [best, o("ebay", 1010)], pays), null);
});

test("the hero carries it as its own placement", () => {
  assert.match(fs.readFileSync("src/components/PriceBox.tsx", "utf8"), /placement="hero_alt"/);
});
