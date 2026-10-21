// The offer detail sources fill (feedback round 2026-10-22): was-price,
// availability, promo and detail, from Shopify, JSON-LD and feeds.
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildIndex } from "../src/lib/matching";
import { retailer } from "../src/lib/retailers";
import { detailOf, feedAvailability, promoOf, schemaAvailability, shopifyAvailability, wasPriceOf } from "../src/lib/sources/detail";
import { rowsToOffers } from "../src/lib/sources/feed";
import { fromProductJs, parseProductJs, productOffers } from "../src/lib/sources/shopify";
import { pageListings } from "../src/lib/sources/structured";
import { CAMERAS, LENSES } from "./fixtures";

const index = buildIndex(CAMERAS, LENSES);
const NOW = "2026-10-22T00:00:00.000Z";

test("was-price: only the store's own, only above the price", () => {
  assert.equal(wasPriceOf(284996, 379995), 379995);
  assert.equal(wasPriceOf(284996, 284996), null);
  assert.equal(wasPriceOf(284996, 100), null);
  assert.equal(wasPriceOf(284996, null), null);
});

test("availability: Shopify fields and tags", () => {
  const a = (o: Partial<Parameters<typeof shopifyAvailability>[0]>) => shopifyAvailability({ available: true, title: "Canon EOS R50", ...o });
  assert.equal(a({ available: false }), "out_of_stock");
  assert.equal(a({ available: false, tags: ["Pre-Order"] }), "out_of_stock");
  assert.equal(a({ tags: ["Pre-Order", "Canon"] }), "preorder");
  assert.equal(a({ title: "Canon EOS R6 Mark III (Preorder)" }), "preorder");
  assert.equal(a({ productType: "Pre-Orders" }), "preorder");
  assert.equal(a({ tags: "AwaitingStock, Brand:Nikon" }), "backorder"); // JB Hi-Fi
  assert.equal(a({ tags: ["Back Order"] }), "backorder");
  assert.equal(a({ tags: ["ETA Nov"] }), "backorder");
  assert.equal(a({ tags: ["Low Stock"] }), "low_stock");
  assert.equal(a({ tags: ["Only 2 left"] }), "low_stock");
  assert.equal(a({ inventoryQuantity: 2 }), "low_stock");
  assert.equal(a({ inventoryQuantity: 12 }), "in_stock");
  // Boilerplate in a description is not about this item; a plain statement is.
  assert.equal(a({ body: "<p>Pre-order items ship as stock arrives. ETA varies.</p>" }), "in_stock");
  assert.equal(a({ body: "<p>This item is available for pre-order now.</p>" }), "preorder");
  assert.equal(a({}), "in_stock");
});

test("availability: schema.org and feed values", () => {
  assert.equal(schemaAvailability("https://schema.org/PreOrder"), "preorder");
  assert.equal(schemaAvailability("http://schema.org/BackOrder"), "backorder");
  assert.equal(schemaAvailability("https://schema.org/LimitedAvailability"), "low_stock");
  assert.equal(schemaAvailability("https://schema.org/OutOfStock"), "out_of_stock");
  assert.equal(schemaAvailability("https://schema.org/InStock"), "in_stock");
  assert.equal(schemaAvailability(undefined), null);
  assert.equal(feedAvailability("preorder"), "preorder");
  assert.equal(feedAvailability("out of stock"), "out_of_stock");
  assert.equal(feedAvailability("in stock"), "in_stock");
  assert.equal(feedAvailability(""), null);
});

test("promo: bonus and promotion text, short and cleaned", () => {
  assert.equal(promoOf({ title: "Sony A7 IV Body with Bonus NP-FZ100 Battery" }), "Bonus NP-FZ100 Battery");
  assert.equal(promoOf({ title: "Canon EOS R6 Mark II + $250 Gift Card" }), "$250 Gift Card");
  assert.equal(promoOf({ title: "Canon EOS R6 Mark II Body (Giftober)" }), "Giftober");
  assert.equal(promoOf({ title: "Nikon Z6 III Free Shipping" }), null);
  assert.equal(promoOf({ title: "Rode Hands-Free Mic" }), null);
  assert.equal(promoOf({ title: "Nikon Z6 III", tags: ["Nikon", "Nikon Cashback"] }), "Nikon Cashback");
  assert.equal(promoOf({ title: "Sony A7 IV", body: "<p>Great camera.</p><p>Claim a $300 trade-in bonus when you trade any camera.</p>" }), "Claim a $300 trade-in bonus when you trade any camera.");
  assert.equal(promoOf({ title: "Sony A7 IV", body: "<p>Dust-free sensor. Free delivery Australia wide.</p>" }), null);
  const long = promoOf({ title: `Sony A7 IV with Bonus ${"very long accessory name ".repeat(10)}` })!;
  assert.ok(long.length <= 120, long);
});

test("detail: variant, branch, grade, shutter count and serial", () => {
  assert.equal(detailOf({ variant: "Default Title", title: "Canon EOS R50" }), null);
  assert.equal(detailOf({ variant: "Silver", title: "Nikon Zf Silver", used: false }), "Silver");
  assert.equal(detailOf({ branch: "Osborne Park Buys & Loans Centre", title: "Canon Eos 5D Mark Iii Black", text: "Condition: Good condition, little sign of wear." }), "Osborne Park store · Good");
  assert.equal(detailOf({ title: "Used Blackmagic Design Pocket Cinema Camera 6K (EX+) (625678666)" }), "EX+");
  assert.equal(detailOf({ title: "Canon EOS 5D Mark IV 24k Act 292057005063" }), "24,000 shutter count");
  assert.equal(detailOf({ title: "Used Canon EOS 6D Body Only S/N 105026000105" }), "SN 105026000105");
  assert.equal(detailOf({ title: "Used Sony a7 III", text: "<p>Shutter count: 12,345</p>" }), "12,345 shutter count");
  assert.equal(detailOf({ title: "Pre-Owned Fujifilm XF 35mm f/2 R WR Lens Black Mint in Box SN: 1CA00639 (Second Hand)" }), "Mint in Box · SN 1CA00639");
  assert.equal(detailOf({ title: "Leica Q3 (Grade 9/10)" }), "Grade 9/10");
});

test("Shopify product: Ted's second-hand listing with its compare-at price and sale tag", () => {
  const p = fromProductJs({
    id: 7805667704875,
    title: "Sony a7 IV | Secondhand",
    handle: "sony-a7-iv-secondhand",
    vendor: "USED",
    type: "Digital Cameras",
    tags: ["25% Off", "2ndSaleOct26", "Sony"],
    description: "<p>Secondhand Stock comes with 12 Month Warranty</p><p>Shutter count: 8,200</p>",
    variants: [{ id: 43053014351915, title: "Default Title", price: 189996, available: true, sku: "150199", compare_at_price: 249995 }],
  });
  const r = retailer("teds")!;
  const { offers } = productOffers(p, { base: "https://www.teds.com.au", retailer: r, index, lenses: LENSES, now: NOW, currency: "AUD" });
  assert.equal(offers.length, 1);
  const o = offers[0];
  assert.equal(o.product, "sony-a7-iv");
  assert.equal(o.condition, "used");
  assert.equal(o.price, 189996);
  assert.equal(o.wasPrice, 249995);
  assert.equal(o.availability, "in_stock");
  assert.equal(o.inStock, true);
  assert.equal(o.detail, "8,200 shutter count");
});

test("Shopify product: a pre-order is shown but not in stock", () => {
  const p = fromProductJs({ id: 1, title: "Sony a7 IV Body", handle: "sony-a7-iv", tags: ["Pre-Order"], variants: [{ id: 2, title: "Default Title", price: 349900, available: true, compare_at_price: null }] });
  const { offers } = productOffers(p, { base: "https://www.teds.com.au", retailer: retailer("teds")!, index, lenses: LENSES, now: NOW, currency: "AUD" });
  assert.equal(offers[0].availability, "preorder");
  assert.equal(offers[0].inStock, false);
  assert.equal(offers[0].wasPrice, null);
});

const ld = (o: unknown) => `<html><script type="application/ld+json">${JSON.stringify(o)}</script></html>`;

test("JSON-LD: strikethrough price, availability, and only real GTIN lengths", () => {
  const [l] = pageListings(
    ld({
      "@type": "Product",
      name: "Sony a7 IV Body",
      gtin8: "74454", // Camera House: its SKU, not a GTIN
      offers: { "@type": "Offer", price: "3299.00", priceCurrency: "AUD", availability: "https://schema.org/PreOrder", priceSpecification: [{ "@type": "UnitPriceSpecification", priceType: "https://schema.org/StrikethroughPrice", price: 3799, priceCurrency: "AUD" }] },
    }),
  );
  assert.equal(l.price, 329900);
  assert.equal(l.wasPrice, 379900);
  assert.equal(l.availability, "preorder");
  assert.equal(l.inStock, false);
  assert.equal(l.gtin, undefined);
  // AggregateOffer's highPrice is the dearest variant, never a was-price.
  const [agg] = pageListings(ld({ "@type": "Product", name: "Sony a7 IV", offers: { "@type": "AggregateOffer", lowPrice: 3299, highPrice: 3999, priceCurrency: "AUD", availability: "https://schema.org/LimitedAvailability" } }));
  assert.equal(agg.wasPrice, undefined);
  assert.equal(agg.availability, "low_stock");
  assert.equal(agg.inStock, true);
});

test("feed: a sale price under the full price makes the full one the was-price", () => {
  const [o] = rowsToOffers("bh", [{ title: "Sony a7 IV Mirrorless Camera Body", link: "https://www.bhphotovideo.com/c/product/1", price: "2499.00 USD", salePrice: "2199.00 USD", availability: "preorder", condition: "new" }], { index, now: NOW, market: "us" });
  assert.equal(o.price, 219900);
  assert.equal(o.wasPrice, 249900);
  assert.equal(o.availability, "preorder");
  assert.equal(o.inStock, false);
});

test("Shopify product .js: served as text/javascript, parsed as JSON, anything else refused", () => {
  const body = JSON.stringify({ id: 1, title: "Nikon Z5IIC Silver (BODY ONLY)", handle: "nikon-z5iic-silver-body-only", tags: ["AwaitingStock"], variants: [{ id: 2, title: "Default Title", price: 239900, available: true, compare_at_price: null }] });
  assert.equal(parseProductJs(body)?.variants[0].price, "2399.00");
  assert.equal(parseProductJs("<html>Not found</html>"), null);
  assert.equal(parseProductJs('{"error":"x"}'), null);
});
