import assert from "node:assert/strict";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { historyFor, mergeOffers } from "../src/lib/import";
import { buildIndex } from "../src/lib/matching";
import type { Offer, OffersFile } from "../src/lib/offers";
import { dailyWindow, priceFloor } from "../src/lib/sources/ebay";
import { cheapestPerProduct, feedCondition, feedRows, headerMap, priceCurrency, rowsToOffers, splitDelimited, type FeedRow } from "../src/lib/sources/feed";
import { robotsAllows, shopifyCondition, storeCondition } from "../src/lib/sources/shopify";
import { toMinor } from "../src/lib/sources/types";
import { CAMERAS, LENSES } from "./fixtures";

const NOW = "2026-10-17T07:00:00.000Z";
const offer = (o: Partial<Offer>): Offer => ({
  product: "sony-a7-iv", kind: "camera", retailer: "bh", condition: "new", price: 219900, currency: "USD", url: "https://www.bhphotovideo.com/x",
  title: "Sony a7 IV", seller: null, inStock: true, kit: false, mount: null, seenAt: NOW, sourceId: null, ...o,
});
const file = (offers: Offer[]): OffersFile => ({ generatedAt: "2026-10-16T07:00:00.000Z", market: "us", currency: "USD", sources: {}, offers });

test("delimited lines: quotes, escaped quotes, tabs", () => {
  assert.deepEqual(splitDelimited('a,"b, c","say ""hi""",', ","), ["a", "b, c", 'say "hi"', ""]);
  assert.deepEqual(splitDelimited("a\tb\tc", "\t"), ["a", "b", "c"]);
});

const readFeed = async (body: string | Uint8Array<ArrayBuffer>) => {
  const out: FeedRow[] = [];
  for await (const r of feedRows(new Response(body).body!)) out.push(r);
  return out;
};

test("an inch mark in an unquoted cell doesn't swallow the rows after it", async () => {
  const tsv = 'id\ttitle\tprice\n1\tAtomos Ninja V 5" HDR Monitor\t399\n2\tSony a7 III Body\t1498\n3\tSmallRig 1/4"-20 Screw\t9\n4\tCanon EOS R5 Body\t3399\n';
  assert.deepEqual((await readFeed(tsv)).map((r) => r.id), ["1", "2", "3", "4"]);
  const csv = 'id,title,price\r\n1,Atomos 5" Monitor,399\r\n2,"Sony a7 IV, body ""mint""\nsecond line",2198\r\n3,Canon EOS R5,3399\r\n';
  const rows = await readFeed(csv);
  assert.deepEqual(rows.map((r) => r.id), ["1", "2", "3"]);
  assert.equal(rows[1].title, 'Sony a7 IV, body "mint"\nsecond line');
});

test("an XML feed on one line yields every item, never the channel's title", async () => {
  const item = (id: string, t: string) => `<item><g:id>${id}</g:id><title>${t}</title><g:shipping><g:price>5.00 USD</g:price></g:shipping><g:price>2198.00 USD</g:price></item>`;
  const xml = `<?xml version="1.0"?><rss><channel><title>Dealer &amp; Co</title>${item("1", "Sony a7 IV")}${item("2", "Canon EOS R5")}</channel></rss>`;
  assert.deepEqual(await readFeed(xml), [
    { id: "1", title: "Sony a7 IV", price: "2198.00 USD" },
    { id: "2", title: "Canon EOS R5", price: "2198.00 USD" },
  ]);
});

test("gzip is read from the bytes, not the URL or content type", async () => {
  const csv = "id,title\n1,Sony a7 IV\n";
  assert.deepEqual((await readFeed(new Uint8Array(gzipSync(csv)))).map((r) => r.title), ["Sony a7 IV"]);
  assert.deepEqual((await readFeed(csv)).map((r) => r.title), ["Sony a7 IV"]);
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

test("prices parse in both decimal styles, and name their currency", () => {
  assert.equal(toMinor("2,498.00 USD"), 249800);
  assert.equal(toMinor("1.299,00 €"), 129900);
  assert.equal(toMinor("£1,899"), 189900);
  assert.equal(toMinor(59.49), 5949);
  assert.equal(priceCurrency("2198.00 GBP"), "GBP");
  assert.equal(priceCurrency("€1.299,00"), "EUR");
  assert.equal(priceCurrency("2198.00"), null);
  assert.equal(priceCurrency("2100.00 CAD"), "CAD");
  assert.equal(priceCurrency("USD 2100"), "USD");
});

test("feed rows become offers only when they are the product, in the market's currency, at a sane price", () => {
  const index = buildIndex(CAMERAS, LENSES);
  const rows = [
    { id: "1", title: "Sony Alpha a7 IV Mirrorless Camera", link: "https://www.bhphotovideo.com/a", price: "2,498.00 USD", salePrice: "2198.00 USD", gtin: "027242923577", availability: "in stock" },
    { id: "2", title: "Sony NP-FZ100 Battery", link: "https://www.bhphotovideo.com/b", price: "78.00 USD" },
    { id: "3", title: "Sony a7 IV Mirrorless Camera", link: "https://www.bhphotovideo.com/c", price: "149.00 USD" },
    { id: "4", title: "Sony a7 IV with FE 28-70mm Lens", link: "https://www.bhphotovideo.com/d", price: "2698.00 USD" },
    { id: "5", title: "Sony a7 III Body", link: "https://www.bhphotovideo.com/e", price: "1498.00", condition: "used", availability: "out of stock" },
    { id: "6", title: "Sony a7 IV Body", link: "https://www.bhphotovideo.com/f", price: "2100.00 CAD" },
    { id: "7", title: "Sigma 24-70mm F2.8 DG DN II Art for Sony E", link: "https://www.bhphotovideo.com/g", price: "1099.00 USD" },
  ];
  const offers = rowsToOffers("bh", rows, { index, now: NOW, market: "us" });
  assert.deepEqual(offers.map((o) => [o.sourceId, o.product, o.price, o.kit, o.condition, o.inStock, o.mount]), [
    ["1", "sony-a7-iv", 219800, false, "new", true, "sony-e"],
    ["4", "sony-a7-iv", 269800, true, "new", true, "sony-e"],
    ["5", "sony-a7-iii", 149800, false, "used", false, "sony-e"],
    ["7", "sigma-24-70mm-f2-8-dg-dn-art-ii", 109900, false, "new", true, "sony-e"],
  ]);
});

test("a dealer listing one product under many SKUs keeps only the cheapest few", () => {
  const many = [5, 4, 3, 2, 1].map((n) => offer({ price: 200000 + n, sourceId: String(n) }));
  assert.deepEqual(cheapestPerProduct(many, 2).map((o) => o.sourceId), ["1", "2"]);
});

test("a failed source keeps yesterday's offers until they age out; a skipped one drops them", () => {
  const prev = file([
    offer({ retailer: "bh", seenAt: "2026-10-16T07:00:00.000Z" }),
    offer({ retailer: "adorama", seenAt: "2026-10-13T07:00:00.000Z" }), // older than 72h
    offer({ retailer: "ebay", seenAt: "2026-10-16T07:00:00.000Z" }),
    offer({ retailer: "keh", seenAt: "2026-10-16T07:00:00.000Z" }), // not run today
  ]);
  const slugs = new Set(CAMERAS.map((c) => c.slug));
  const merged = mergeOffers(prev, { bh: { status: "error", note: "500" }, adorama: { status: "error", note: "500" }, ebay: { status: "skipped", note: "no keys" }, amazon: { status: "ok", offers: [offer({ retailer: "amazon" })] } }, NOW, slugs);
  assert.deepEqual(merged.map((o) => o.retailer).sort(), ["amazon", "bh", "keh"]);
});

test("a rotating source replaces only the products it covered", () => {
  const prev = file([offer({ retailer: "ebay", product: "sony-a7-iv", price: 200000 }), offer({ retailer: "ebay", product: "sony-a7-iii", price: 150000 })]);
  const slugs = new Set(CAMERAS.map((c) => c.slug));
  const merged = mergeOffers(prev, { ebay: { status: "ok", offers: [offer({ retailer: "ebay", product: "sony-a7-iv", price: 190000 })], covered: ["sony-a7-iv"] } }, NOW, slugs);
  assert.deepEqual(merged.map((o) => [o.product, o.price]).sort(), [["sony-a7-iii", 150000], ["sony-a7-iv", 190000]]);
});

test("the daily window walks the whole catalog over consecutive days", () => {
  const items = Array.from({ length: 10 }, (_, i) => i);
  const seen = new Set([0, 1, 2, 3].flatMap((d) => dailyWindow(items, 3, d)));
  assert.equal(seen.size, 10);
  assert.deepEqual(dailyWindow(items, 20, 5), items);
});

test("history keeps the lowest in-stock body-only price per condition group", () => {
  const h = historyFor("us", "2026-10-17", [
    offer({ price: 219900 }),
    offer({ price: 199900, kit: true }),
    offer({ price: 189900, inStock: false }),
    offer({ price: 159900, condition: "used" }),
    offer({ price: 169900, condition: "refurbished" }),
  ]);
  // usedMid/usedN: the median and count of in-stock body-only used and refurbished prices.
  assert.deepEqual(h.prices, { "sony-a7-iv": { new: 219900, used: 159900, usedMid: 164900, usedN: 2 } });
  assert.equal(h.currency, "USD");
});

test("Shopify: robots.txt is respected and conditions read from titles and tags", () => {
  assert.equal(robotsAllows("User-agent: *\nDisallow: /checkout", "/products.json"), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /products", "/products.json"), false);
  assert.equal(robotsAllows("User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /cart", "/products.json"), true);
  // Shopify's default rules are wildcards, not prefixes.
  const shopify = "User-agent: *\nAllow: /\nDisallow: /cart.js\nDisallow: /*/collections/*+*\nDisallow: */collections/*filter*&*filter*\nDisallow: /*?*oseid=*\nDisallow: /*.atom$";
  assert.equal(robotsAllows(shopify, "/products.json"), true);
  assert.equal(robotsAllows(shopify, "/collections/cameras/products.json?limit=250&page=1&country=AU"), true);
  assert.equal(robotsAllows(shopify, "/en/collections/a+b"), false);
  assert.equal(robotsAllows(shopify, "/cart.js"), false);
  assert.equal(robotsAllows(shopify, "/blogs/news.atom"), false);
  assert.equal(robotsAllows(shopify, "/blogs/news.atom?x=1"), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /*?limit=", "/products.json?limit=250"), false);
  // The longest rule wins, and consecutive User-agent lines share their rules.
  assert.equal(robotsAllows("User-agent: *\nDisallow: /products\nAllow: /products.json", "/products.json"), true);
  assert.equal(robotsAllows("User-agent: Googlebot\nUser-agent: *\nDisallow: /products", "/products.json"), false);
  assert.equal(shopifyCondition({ title: "Sony a7 III (Used)", tags: [] }, ""), "used");
  assert.equal(shopifyCondition({ title: "Sony a7 III", tags: ["Pre-Owned"] }, ""), "used");
  // A second-hand-only store's untagged stock is used, not new (Cash Converters SG).
  assert.equal(storeCondition("new", ["used"]), "used");
  assert.equal(storeCondition("refurbished", ["used"]), "refurbished");
  assert.equal(storeCondition("new", ["new", "used"]), "new");
  assert.equal(shopifyCondition({ title: "Sony a7 IV Ex-Demo", tags: "" }, ""), "open-box");
  assert.equal(shopifyCondition({ title: "Sony a7 IV", product_type: "Cameras" }, "Body"), "new");
});

test("Amazon prices are never kept past a day, and stay out of stored and derived prices", async () => {
  const { lowest } = await import("../src/lib/offers");
  const day2 = "2026-10-18T08:00:00.000Z"; // 25 hours after NOW
  const prev = file([offer({ retailer: "amazon", price: 209900 }), offer({ retailer: "bh" })]);
  const kept = mergeOffers(prev, { amazon: { status: "error", note: "down" }, bh: { status: "error", note: "down" } }, day2, new Set(["sony-a7-iv"]));
  assert.deepEqual(kept.map((o) => o.retailer), ["bh"]);

  const both = [offer({ retailer: "amazon", price: 209900 }), offer({ retailer: "bh" })];
  assert.equal(lowest(both, "new")?.retailer, "bh");
  assert.equal(lowest(both, "new", true)?.retailer, "amazon");
  assert.deepEqual(Object.keys(historyFor("us", "2026-10-17", both).prices), ["sony-a7-iv"]);
  assert.equal(historyFor("us", "2026-10-17", both).prices["sony-a7-iv"].new, 219900);
});

test("eBay searches start at the used price floor, in the market's currency", () => {
  assert.equal(priceFloor({ launchPriceUsd: 2499, launchPrices: {} }, "USD"), 299);
  assert.equal(priceFloor({ launchPriceUsd: 2499, launchPrices: { GBP: 2399 } }, "GBP"), 287);
  assert.equal(priceFloor({ launchPriceUsd: null, launchPrices: {} }, "USD"), 30);
  assert.equal(priceFloor({ launchPriceUsd: null, launchPrices: { GBP: 790 } }, "USD"), 120);
});

test("run notes never carry a feed URL or its query string", async () => {
  const { redact } = await import("../src/lib/import");
  const env = { FEED_URL_WEX: "https://feeds.example.com/p?key=s3cret123" };
  assert.equal(redact("fetch failed: https://feeds.example.com/p?key=s3cret123", env), "fetch failed: [FEED_URL_WEX]");
  assert.equal(redact("404 at https://x.example/feed.csv?token=abc&id=2", {}), "404 at https://x.example/feed.csv?[…]");
});

test("feed rows need an http(s) link and their currency column must match", () => {
  const index = buildIndex(CAMERAS, LENSES);
  const base = { id: "1", title: "Sony a7 IV Body", price: "2198.00", availability: "in stock" };
  const run = (row: Record<string, string>) => rowsToOffers("bh", [row], { index, now: NOW, market: "us" });
  assert.equal(run({ ...base, link: "javascript:alert(1)" }).length, 0);
  assert.equal(run({ ...base, link: "/relative/path" }).length, 0);
  assert.equal(run({ ...base, link: "https://www.bhphotovideo.com/a", currency: "CAD" }).length, 0);
  assert.equal(run({ ...base, link: "https://www.bhphotovideo.com/a", currency: "usd" }).length, 1);
});

test("structured data: JSON-LD offers and OpenGraph prices are read, slugs become words, bot walls are seen", async () => {
  const { pageListings, slugText, blockedReason } = await import("../src/lib/sources/structured");
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"24-70mm f/2.8 E ED AFS VR","brand":{"@type":"Brand","name":"Nikon"},"sku":"N1","offers":{"@type":"Offer","price":"1,446.95","priceCurrency":"USD","availability":"https://schema.org/InStock","itemCondition":"https://schema.org/NewCondition"}}</script>`;
  assert.deepEqual(pageListings(ld), [{ title: "Nikon 24-70mm f/2.8 E ED AFS VR", gtin: undefined, mpn: undefined, sku: "N1", price: 144695, currency: "USD", inStock: true, condition: "new" }]);
  const og = `<meta property="og:title" content="Sony a7 IV Body"><meta property="product:price:amount" content="2198.00"><meta property="product:price:currency" content="GBP">`;
  assert.equal(pageListings(og)[0].currency, "GBP");
  assert.equal(pageListings(`<script type="application/ld+json">{"@type":"Product","name":"X","offers":{"price":"10"}}</script>`).length, 0); // no currency: refused
  assert.equal(slugText("https://x.com/canon-eos-r6-mark-ii-body.html"), "canon eos r6 mark ii body");
  assert.equal(blockedReason(200, new Headers(), "<title>Just a moment...</title>"), "bot challenge page");
  assert.equal(blockedReason(200, new Headers(), "<title>Sony a7 IV</title>"), null);
});

test("an Open Box listing tagged used stays open-box", () => {
  assert.equal(shopifyCondition({ title: "Panasonic Lumix DMC-FZ300 - Open Box", tags: ["used"] }, "Default Title"), "open-box");
});

test("Shopify requests back off on 429/5xx and give up after four retries", async () => {
  const { politeGet } = await import("../src/lib/sources/shopify");
  const real = globalThis.fetch;
  const waits: number[] = [];
  let calls = 0;
  const statuses = [503, 503, 200];
  globalThis.fetch = (async () => new Response("{}", { status: statuses[Math.min(calls++, statuses.length - 1)] })) as typeof fetch;
  try {
    assert.equal((await politeGet("https://x.test/products.json", {}, async (ms) => void waits.push(ms))).status, 200);
    assert.deepEqual(waits, [2000, 4000]);
    calls = 0;
    waits.length = 0;
    statuses.splice(0, 3, 503);
    assert.equal((await politeGet("https://x.test/products.json", {}, async (ms) => void waits.push(ms))).status, 503);
    assert.equal(waits.length, 4);
  } finally {
    globalThis.fetch = real;
  }
});
