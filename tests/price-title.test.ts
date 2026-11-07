import assert from "node:assert/strict";
import { test } from "node:test";
import type { Offer } from "../src/lib/offers";
import { priceDescription, priceTitle, storeCount } from "../src/lib/price-rules";

// Search Console 90 days to 2026-11-04 (DECISIONS.md, 2026-11-07): "<model> price", "<model> price 2026",
// "<model> price in australia", "sell <model>". Each title fits 60 characters with " | CamCompare".
const offer = (o: Partial<Offer>): Offer => ({ product: "x", kind: "camera", retailer: "wex", condition: "new", price: 899500, currency: "USD", url: "https://example.com/x", title: "X", seller: null, inStock: true, kit: false, mount: null, seenAt: "2026-11-06T00:00:00Z", sourceId: null, ...o });
const fits = (t: string) => `${t} | CamCompare`.length <= 60;

test("a product title leads with the price, the year and the store count when they fit", () => {
  const offers = [offer({ retailer: "a" }), offer({ retailer: "b", price: 905000 }), offer({ retailer: "c", condition: "used", price: 649500 })];
  assert.equal(storeCount(offers), 3);
  const t = priceTitle("Leica M11", offers, "USD", null, 2026);
  assert.match(t, /^Leica M11 price 2026: from \$8,995(\.00)?, 3 stores$/);
  assert.ok(fits(t), t);
  const au = priceTitle("Leica M11", offers.map((o) => ({ ...o, currency: "AUD" as const })), "AUD", { long: "Australia", short: "AU" }, 2026);
  assert.match(au, /^Leica M11 price in Australia 2026: from /);
  assert.ok(fits(au), au);
  const long = priceTitle("Canon PowerShot G7 X Mark III Premium Kit Edition", offers, "USD", { long: "Australia", short: "AU" }, 2026);
  assert.ok(fits(long) || long === "Canon PowerShot G7 X Mark III Premium Kit Edition price AU", long);
});

test("a product with only used stock says so; one with none names the year", () => {
  assert.match(priceTitle("Nikon Z6", [offer({ condition: "used", price: 62360 })], "USD", null, 2026), /^Nikon Z6 price 2026: used from \$623/);
  assert.equal(priceTitle("Sony FX5", [], "USD", null, 2026), "Sony FX5 price 2026 & specs");
  assert.equal(priceTitle("Sony FX5", [offer({ kit: true })], "USD", null, 2026), "Sony FX5 price 2026 & specs", "a kit is never the body price");
});

test("a product snippet leads with the price and stays within 160 characters", () => {
  const offers = [offer({ retailer: "a" }), offer({ retailer: "b", price: 905000 }), offer({ retailer: "c", condition: "used", price: 649500 })];
  const d = priceDescription({ name: "Leica M11", place: "the US", offers, currency: "USD", pack: "body", specs: "60.3 MP full-frame rangefinder, announced 2022.", tail: "Full specs, price history and side-by-side comparisons." });
  assert.match(d, /^Leica M11 price in the US: new from \$8,995(\.00)? at 3 stores, used from \$6,495/);
  assert.ok(d.length <= 160, `${d.length}: ${d}`);
  const none = priceDescription({ name: "Sony FX5", place: "the UK", offers: [], currency: "GBP", pack: "body", specs: "16.6 MP cinema camera, announced 2026.", tail: "Full specs, price history and side-by-side comparisons." });
  assert.match(none, /^Sony FX5 price in the UK: no store we compare has it in stock today\./);
  assert.ok(none.length >= 120 && none.length <= 160, `${none.length}: ${none}`);
});
