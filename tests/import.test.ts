import assert from "node:assert/strict";
import { test } from "node:test";
import { historyFor, mergeOffers } from "../src/lib/import";
import { buildIndex } from "../src/lib/matching";
import type { Offer, OffersFile } from "../src/lib/offers";
import { cheapestPerCamera, feedCondition, headerMap, rowsToOffers, splitDelimited } from "../src/lib/sources/feed";
import { CAMERAS } from "./fixtures";

const NOW = "2026-10-17T07:00:00.000Z";
const offer = (o: Partial<Offer>): Offer => ({
  camera: "sony-a7-iv", retailer: "bh", condition: "new", priceCents: 219900, currency: "USD", url: "https://www.bhphotovideo.com/x",
  title: "Sony a7 IV", seller: null, inStock: true, kit: false, seenAt: NOW, sourceId: null, ...o,
});

test("delimited lines: quotes, escaped quotes, tabs", () => {
  assert.deepEqual(splitDelimited('a,"b, c","say ""hi""",', ","), ["a", "b, c", 'say "hi"', ""]);
  assert.deepEqual(splitDelimited("a\tb\tc", "\t"), ["a", "b", "c"]);
});

test("feed headers from different networks map to the same fields", () => {
  const google = headerMap(["id", "title", "link", "price", "sale_price", "availability", "condition", "gtin", "mpn"]);
  assert.deepEqual([...google.values()], ["id", "title", "link", "price", "salePrice", "availability", "condition", "gtin", "mpn"]);
  const impact = headerMap(["Unique Merchant SKU", "Product Name", "Product URL", "Current Price", "UPC", "Manufacturer Part Number"]);
  assert.deepEqual([...impact.values()], ["id", "title", "link", "price", "gtin", "mpn"]);
});

test("feed condition words", () => {
  assert.equal(feedCondition("new"), "new");
  assert.equal(feedCondition(""), "new");
  assert.equal(feedCondition("Refurbished"), "refurbished");
  assert.equal(feedCondition("Used - Excellent"), "used");
  assert.equal(feedCondition("Open Box"), "open-box");
});

test("feed rows become offers only when they are the camera, at a sane price", () => {
  const index = buildIndex(CAMERAS);
  const rows = [
    { id: "1", title: "Sony Alpha a7 IV Mirrorless Camera", link: "https://www.bhphotovideo.com/a", price: "2,498.00 USD", salePrice: "2198.00 USD", gtin: "027242923577", availability: "in stock" },
    { id: "2", title: "Sony NP-FZ100 Battery", link: "https://www.bhphotovideo.com/b", price: "78.00 USD" },
    { id: "3", title: "Sony a7 IV Mirrorless Camera", link: "https://www.bhphotovideo.com/c", price: "149.00 USD" },
    { id: "4", title: "Sony a7 IV with FE 28-70mm Lens", link: "https://www.bhphotovideo.com/d", price: "2698.00 USD" },
    { id: "5", title: "Sony a7 III Body", link: "https://www.bhphotovideo.com/e", price: "1498.00", condition: "used", availability: "out of stock" },
  ];
  const offers = rowsToOffers("bh", rows, { index, now: NOW });
  assert.deepEqual(offers.map((o) => [o.sourceId, o.camera, o.priceCents, o.kit, o.condition, o.inStock]), [
    ["1", "sony-a7-iv", 219800, false, "new", true],
    ["4", "sony-a7-iv", 269800, true, "new", true],
    ["5", "sony-a7-iii", 149800, false, "used", false],
  ]);
});

test("a dealer listing one camera under many SKUs keeps only the cheapest few", () => {
  const many = [5, 4, 3, 2, 1].map((n) => offer({ priceCents: 200000 + n, sourceId: String(n) }));
  assert.deepEqual(cheapestPerCamera(many, 2).map((o) => o.sourceId), ["1", "2"]);
});

test("a failed source keeps yesterday's offers until they age out; a skipped one drops them", () => {
  const prev: OffersFile = {
    generatedAt: "2026-10-16T07:00:00.000Z", market: "US", sources: {},
    offers: [
      offer({ retailer: "bh", seenAt: "2026-10-16T07:00:00.000Z" }),
      offer({ retailer: "adorama", seenAt: "2026-10-13T07:00:00.000Z" }), // older than 72h
      offer({ retailer: "ebay", seenAt: "2026-10-16T07:00:00.000Z" }),
      offer({ retailer: "keh", seenAt: "2026-10-16T07:00:00.000Z" }), // not run today
    ],
  };
  const slugs = new Set(CAMERAS.map((c) => c.slug));
  const merged = mergeOffers(prev, { bh: { status: "error", note: "500" }, adorama: { status: "error", note: "500" }, ebay: { status: "skipped", note: "no keys" }, amazon: { status: "ok", offers: [offer({ retailer: "amazon" })] } }, NOW, slugs);
  assert.deepEqual(merged.map((o) => o.retailer).sort(), ["amazon", "bh", "keh"]);
});

test("history keeps the lowest in-stock body-only price per condition group", () => {
  const h = historyFor("2026-10-17", [
    offer({ priceCents: 219900 }),
    offer({ priceCents: 199900, kit: true }),
    offer({ priceCents: 189900, inStock: false }),
    offer({ priceCents: 159900, condition: "used" }),
    offer({ priceCents: 169900, condition: "refurbished" }),
  ]);
  assert.deepEqual(h.prices, { "sony-a7-iv": { new: 219900, used: 159900 } });
});
