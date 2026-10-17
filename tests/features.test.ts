import assert from "node:assert/strict";
import { test } from "node:test";
import { recommend } from "../src/lib/finder";
import { dealSignal, priceDrops, usedSaving, vsLaunch } from "../src/lib/insights";
import { productLd } from "../src/lib/jsonld";
import { isGlobalPath, marketForCountry, marketFromPath, rememberMarket, switchMarketPath, visitorMarket } from "../src/lib/market-client";
import { marketPath, money } from "../src/lib/markets";
import type { Offer } from "../src/lib/offers";
import { alternates } from "../src/lib/seo";
import { CAMERAS } from "./fixtures";
import { searchRank, type SearchRow } from "../src/lib/search";
import type { CameraSummary } from "../src/lib/summary";

test("market paths: the US is the root, the others are prefixes", () => {
  assert.equal(marketPath("us", "/cameras/x"), "/cameras/x");
  assert.equal(marketPath("uk", "/cameras/x"), "/uk/cameras/x");
  assert.equal(marketPath("au", "/"), "/au");
  assert.equal(marketFromPath("/eu/lenses"), "eu");
  assert.equal(marketFromPath("/cameras"), "us");
  assert.equal(marketFromPath("/us/cameras"), "us");
});

test("switching market keeps the page, and global pages stay put", () => {
  assert.equal(switchMarketPath("/cameras/sony-a7-iv", "uk"), "/uk/cameras/sony-a7-iv");
  assert.equal(switchMarketPath("/uk/cameras/sony-a7-iv", "us"), "/cameras/sony-a7-iv");
  assert.equal(switchMarketPath("/sg", "au"), "/au");
  assert.equal(switchMarketPath("/au", "us"), "/");
  assert.equal(switchMarketPath("/compare/a-vs-b", "uk"), "/compare/a-vs-b");
  // The builder is per market; only a pair page is global.
  assert.equal(switchMarketPath("/uk/compare", "eu"), "/eu/compare");
  assert.ok(isGlobalPath("/compare/a-vs-b") && isGlobalPath("/guides/sensor-sizes") && !isGlobalPath("/compare") && !isGlobalPath("/uk/cameras"));
});

test("a global page follows the market the visitor chose or was last in", () => {
  const store = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };
  const g = globalThis as Record<string, unknown>;
  const events: string[] = [];
  Object.assign(g, { localStorage: store(), sessionStorage: store(), document: { cookie: "" }, window: { dispatchEvent: (e: Event) => events.push(e.type) } });
  try {
    assert.equal(visitorMarket(), null);
    rememberMarket("uk");
    assert.equal(visitorMarket(), "uk");
    assert.deepEqual(events, ["cc-market"]);
    // A later market page in this tab wins over the remembered choice.
    (g.sessionStorage as Storage).setItem("cc_market_seen", "eu");
    assert.equal(visitorMarket(), "eu");
  } finally {
    for (const k of ["localStorage", "sessionStorage", "document", "window"]) delete g[k];
  }
});

test("a switched path is always one site path, never a //host URL", () => {
  assert.equal(switchMarketPath("/uk//evil.example/x", "us"), "/evil.example/x");
  assert.equal(switchMarketPath("//evil.example", "uk"), "/uk/evil.example");
  assert.equal(marketFromPath("/uk//x"), "uk");
});

test("the EU market's hreflang names every EU country, while it is indexable", () => {
  const all = alternates("/cameras/x").languages as Record<string, string>;
  assert.equal(all["en-DE"], "/eu/cameras/x");
  assert.equal(all["en-IE"], "/eu/cameras/x");
  assert.equal(all["en-GB"], "/uk/cameras/x");
  assert.equal(all["x-default"], "/cameras/x");
  const usOnly = alternates("/cameras/x", () => false).languages as Record<string, string>;
  assert.deepEqual(Object.keys(usOnly).sort(), ["en-US", "x-default"]);
});

test("countries map to markets; elsewhere gets no suggestion", () => {
  assert.equal(marketForCountry("GB"), "uk");
  assert.equal(marketForCountry("de"), "eu");
  assert.equal(marketForCountry("SG"), "sg");
  assert.equal(marketForCountry("CA"), null);
  assert.equal(marketForCountry(null), null);
});

test("money shows what the retailer charges, cents only when there are some", () => {
  assert.equal(money(189900, "GBP", true), "£1,899");
  assert.equal(money(189899, "GBP", true), "£1,898.99");
  assert.equal(money(249850, "AUD", true), "A$2,498.50");
  assert.equal(money(2999, "AUD"), "A$2,999");
  assert.equal(money(1299, "SGD"), "S$1,299");
});

test("product JSON-LD prices only what the page prices, and is absent without it", () => {
  const offer = (o: Partial<Offer>): Offer => ({
    product: "sony-a7-iv", kind: "camera", retailer: "test-shop", condition: "new", price: 199900, currency: "GBP", url: "https://shop.example/a7iv",
    title: "Sony a7 IV", seller: null, inStock: true, kit: false, mount: null, seenAt: "2026-10-17T00:00:00Z", sourceId: null, ...o,
  });
  const a7iv = CAMERAS[0];
  const ld = productLd(a7iv, "camera", [offer({}), offer({ condition: "used", price: 120000, inStock: false })], "uk");
  assert.equal(ld?.offers.lowPrice, "1999.00");
  assert.equal(ld?.offers.offerCount, 1);
  assert.equal(productLd(a7iv, "camera", [offer({ inStock: false }), offer({ kit: true })], "uk"), null);
  assert.equal(productLd(a7iv, "camera", [], "us"), null);
});

test("search finds squashed and spaced spellings, best match first", () => {
  const rows: SearchRow[] = [
    { s: "sony-a7-iv", k: "c", n: "Sony α7 IV", a: "a7 IV a7IV Alpha 7 IV Sony", y: "2021" },
    { s: "sony-a7r-iv", k: "c", n: "Sony α7R IV", a: "a7R IV Sony", y: "2019" },
    { s: "sony-fe-24-70mm-f2-8-gm-ii", k: "l", n: "Sony FE 24-70mm F2.8 GM II", a: "24-70mm F2.8 GM II Sony", y: "2022" },
  ];
  assert.equal(searchRank(rows, "a7iv")[0].s, "sony-a7-iv");
  assert.equal(searchRank(rows, "sony a7 iv")[0].s, "sony-a7-iv");
  assert.equal(searchRank(rows, "2470")[0].s, "sony-fe-24-70mm-f2-8-gm-ii");
  assert.equal(searchRank(rows, "gm ii").length, 1);
  assert.deepEqual(searchRank(rows, "nikon"), []);
});

test("deal signals need two weeks of history and compare like with like", () => {
  const days = (n: number, v: number) => Array.from({ length: n }, (_, i) => ({ day: `2026-09-${String(i + 1).padStart(2, "0")}`, new: v }));
  assert.equal(dealSignal(days(10, 2000), 1900), null);
  assert.equal(dealSignal(days(20, 2000), 1900)?.kind, "low-90");
  assert.equal(dealSignal([...days(19, 2000), { day: "2026-09-20", new: 1800 }], 1900)?.kind, "below-avg");
  assert.equal(dealSignal(days(20, 2000), 2200)?.kind, "above-avg");
  assert.equal(usedSaving(200000, 150000), 25);
  assert.equal(usedSaving(150000, 200000), null);
  assert.equal(vsLaunch(219900, 2499), -12);
});

test("price drops compare today with a week earlier", () => {
  const h = new Map([
    ["a", [{ day: "2026-10-01", new: 100000 }, { day: "2026-10-08", new: 90000 }]],
    ["b", [{ day: "2026-10-07", new: 100000 }, { day: "2026-10-08", new: 99000 }]],
    ["c", [{ day: "2026-10-01", new: 100000 }, { day: "2026-10-08", new: 101000 }]],
  ]);
  assert.deepEqual(priceDrops(h, "new").map((d) => [d.slug, d.pct]), [["a", 10]]);
});

const cam = (o: Partial<CameraSummary>): CameraSummary => ({
  kind: "camera", slug: "x", name: "X", shortName: "X", brand: "sony", brandName: "Sony", announced: "2023-01-01", status: "current", currency: "USD",
  launch: 1000, lowestNew: null, lowestUsed: null, thumb: "", weightG: 500, sealed: false, type: "mirrorless", sensor: "full-frame", mount: "sony-e",
  megapixels: 24, ibis: false, videoMaxRes: "4K", video4kMaxFps: 30, burstFps: 10, evf: true, articulating: false, micJack: false, dims: null,
  subjects: null, waterproofM: null, fixedZoom: false, ...o,
});

test("the finder ranks by the stated rules and respects budget and size", () => {
  const vlog = cam({ slug: "vlog", articulating: true, micJack: true, video4kMaxFps: 60, weightG: 400 });
  const plain = cam({ slug: "plain" });
  const heavy = cam({ slug: "heavy", articulating: true, micJack: true, weightG: 900 });
  const pricey = cam({ slug: "pricey", articulating: true, micJack: true, launch: 5000 });
  const out = recommend([plain, vlog, heavy, pricey], "vlogging", "small", 2000, (c) => c.launch);
  assert.equal(out[0].c.slug, "vlog");
  assert.ok(!out.some((x) => x.c.slug === "heavy" || x.c.slug === "pricey"));
  assert.ok(out[0].reasons.includes("Mic input"));
});
