import assert from "node:assert/strict";
import { test } from "node:test";
import { guideHtml } from "../src/lib/guides";
import { savedChange, type SavedItem } from "../src/lib/saved";
import { replaceQuery } from "../src/lib/search";

test("guides keep site-internal links only, and raw HTML renders as text", () => {
  assert.equal(guideHtml("[ok](/cameras)").trim(), '<p><a href="/cameras">ok</a></p>');
  assert.equal(guideHtml('[t](/lenses "All lenses")').trim(), '<p><a href="/lenses" title="All lenses">t</a></p>');
  for (const md of ['[c](https://evil.example "Read more")', "[b](//evil.example/x)", "[s](/\\evil.example)", '[d](javascript:alert(1) "x")', "<https://evil.example>", "see https://bare.example", "![p](https://x.example/y.jpg)"]) {
    const html = guideHtml(md);
    assert.ok(!/<a |<img /.test(html), `${md} -> ${html}`);
  }
  assert.ok(!/<a |<img /.test(guideHtml('<a href="https://x" rel="y">raw</a>')));
  assert.ok(!guideHtml("<img src=x onerror=alert(1)>").includes("<img"));
  assert.ok(guideHtml("![p](/products/a.webp)").includes('<img src="/products/a.webp"'));
});

test("the saved list measures a change like with like", () => {
  const item = (seen: number, cond?: "new" | "used"): SavedItem => ({ slug: "x", kind: "c", market: "us", at: "2026-10-01", seen, cond });
  // Saved new; the new offers went out of stock: show used, no "drop".
  assert.deepEqual(savedChange(item(199900, "new"), [null, 149900], "us"), { now: 149900, cond: "used", delta: null });
  // Saved used; a dearer new offer appeared: lead with used, measure used.
  assert.deepEqual(savedChange(item(149900, "used"), [199900, 139900], "us"), { now: 139900, cond: "used", delta: -10000 });
  assert.deepEqual(savedChange(item(149900, "used"), [199900, null], "us"), { now: 199900, cond: "new", delta: null });
  // An entry saved before the condition was kept is read as new.
  assert.deepEqual(savedChange(item(199900), [189900, 149900], "us"), { now: 189900, cond: "new", delta: -10000 });
  // Another market's saved price is never compared.
  assert.equal(savedChange(item(199900, "new"), [189900, null], "uk").delta, null);
  assert.deepEqual(savedChange(item(199900, "new"), undefined, "us"), { now: null, cond: null, delta: null });
});

test("filter state goes into the query string without a history entry", () => {
  const calls: string[] = [];
  const g = globalThis as Record<string, unknown>;
  const loc = { pathname: "/lenses", search: "?utm_source=x&mount=canon-rf", hash: "" };
  g.window = { location: loc, history: { replaceState: (_d: unknown, _t: string, url: string) => void calls.push(url) } };
  try {
    replaceQuery({ mount: "sony-e,sigma-l", budget: 800, sort: null, q: "" });
    assert.deepEqual(calls, ["/lenses?utm_source=x&mount=sony-e,sigma-l&budget=800"]);
    loc.search = "?utm_source=x&mount=sony-e,sigma-l&budget=800";
    replaceQuery({ mount: "sony-e,sigma-l", budget: 800, sort: null });
    assert.equal(calls.length, 1, "an unchanged query is not written again");
    replaceQuery({ utm_source: null, mount: "", budget: null });
    assert.equal(calls[1], "/lenses");
  } finally {
    delete g.window;
  }
});

// ------------------------------------------------------------ quick view, rows, highlights
import { cameraHighlights, cardChips, lensHighlights } from "../src/lib/highlights";
import { alsoCheckLinks, offerRows, quickViewData } from "../src/lib/offer-rows";
import { viewParam, withView } from "../src/lib/quickview";
import type { Offer } from "../src/lib/offers";
import { cam, lensFix } from "./fixtures";

const offer = (retailer: string, price: number, o: Partial<Offer> = {}): Offer => ({
  product: "sony-a7-iv", kind: "camera", retailer, condition: "new", price, currency: "USD", url: `https://example.com/${retailer}/${price}`,
  title: "Sony a7 IV", seller: null, inStock: true, kit: false, mount: null, seenAt: "2026-10-17T06:00:00Z", sourceId: `${retailer}-${price}`, ...o,
});

test("price rows: sorted by price, eBay apart, Amazon only where shown live, links wrapped with a sub-id", () => {
  const env = process.env.AFFILIATE_DEEPLINK_ADORAMA;
  process.env.AFFILIATE_DEEPLINK_ADORAMA = "https://x.sjv.io/c/1/2/3?u={url}&subId1={subid}";
  try {
    const offers = [offer("bh", 249900), offer("adorama", 239900, { url: "https://www.adorama.com/isoa74.html" }), offer("amazon", 199900), offer("ebay", 150000), offer("mpb", 180000, { condition: "used" }), offer("bh", 260000, { kit: true }), offer("walmart", 100000, { inStock: false })];
    const rows = offerRows(offers, { page: "qv-us-sony-a7-iv", placement: "quickview", pack: "body", withAmazon: false });
    assert.deepEqual(rows.map((r) => [r.retailer, r.price]), [["mpb", 180000], ["adorama", 239900], ["bh", 249900], ["walmart", 100000], ["bh", 260000]]);
    const ad = rows.find((r) => r.retailer === "adorama")!;
    assert.ok(ad.paid && ad.href.includes("sjv.io") && ad.href.includes("quickview"));
    assert.equal(rows.find((r) => r.retailer === "bh")!.paid, false);
    assert.equal(rows[0].pack, "Body only");
    assert.equal(rows.at(-1)!.pack, "With lens");
    assert.ok(offerRows(offers, { page: "p", placement: "offers", pack: "body", withAmazon: true }).some((r) => r.amazon && r.seenAt));
  } finally {
    if (env === undefined) delete process.env.AFFILIATE_DEEPLINK_ADORAMA;
    else process.env.AFFILIATE_DEEPLINK_ADORAMA = env;
  }
});

test("the quick view file never carries an Amazon price, only a link; no dealer check rows", () => {
  const c = cam("sony-a7-iv", "sony", ["Sony a7 IV"]);
  const offers = [offer("amazon", 199900), offer("bh", 249900)];
  const d = quickViewData({ kind: "camera", item: c }, "us", offers, null);
  assert.deepEqual(d.rows.map((r) => r.retailer), ["bh"]);
  assert.ok(!JSON.stringify(d).includes("199900") && !JSON.stringify(d).includes("1,999"));
  assert.deepEqual(d.alsoCheck.map((l) => l.retailer), ["amazon", "ebay"]);
  // Live eBay listings replace the eBay search link; Amazon shown live drops its link.
  const links = alsoCheckLinks({ product: c.slug, query: "Sony a7 IV", offers: [offer("ebay", 150000)], market: "us", page: "p", placement: "check", amazonShown: true });
  assert.deepEqual(links, []);
});

test("spec highlights use catalog facts only and skip nulls", () => {
  const h = cameraHighlights(cam("x", "sony", ["X"], {}, { megapixels: 33, ibisStops: 5.5, weatherSealed: null, afSubjects: null, afPoints: null }));
  const by = Object.fromEntries(h.map((x) => [x.key, x.value]));
  assert.equal(by.sensor, "33 MP");
  assert.equal(by.ibis, "5.5 stops");
  assert.equal(by.video, "4K 60p");
  assert.ok(!("sealed" in by) && !("af" in by));
  assert.ok(h.length >= 4 && h.length <= 8);
  assert.equal(cameraHighlights(cam("y", "sony", ["Y"], {}, { ibis: false })).find((x) => x.key === "ibis")!.off, true);
  const fixed = cameraHighlights(cam("z", "fujifilm", ["Z"], { mount: null, fixedLens: { focalMm: [35], aperture: "f/2" } }));
  assert.ok(fixed.length <= 8 && fixed.some((x) => x.key === "lens" && x.value === "35mm"));
  const l = lensHighlights(lensFix("l", "sony", ["L"], {}, { stabilized: null }));
  assert.deepEqual(l.map((x) => x.key), ["focal", "aperture", "af", "weight", "sealed", "close"]);
  assert.equal(l[1].detail, "Constant through the zoom");
});

test("card chips add what the subline doesn't say", () => {
  const p = { kind: "camera", ibis: true, videoMaxRes: "8K", video4kMaxFps: 120, sealed: true, waterproofM: null, burstFps: 30, weightG: 700 } as never;
  assert.deepEqual(cardChips(p), ["IBIS", "8K video", "Weather sealed"]);
});

test("the quick view lives in ?view and leaves other keys alone", () => {
  assert.equal(withView("/lenses", "?mount=sony-e,l-mount", "", "sony-fe-50mm"), "/lenses?mount=sony-e,l-mount&view=sony-fe-50mm");
  assert.equal(withView("/lenses", "?mount=sony-e&view=x", "", null), "/lenses?mount=sony-e");
  assert.equal(viewParam("?view=sony-a7-iv"), "sony-a7-iv");
  assert.equal(viewParam("?view=../etc"), null);
});

test("low light: pixel pitch from sensor area and megapixels, links pre-filled", async () => {
  const { pixelPitchUm, lowLightLinks, ptpName } = await import("../src/lib/lowlight");
  const { CAMERAS } = await import("./fixtures");
  const a7iv = CAMERAS.find((c) => c.slug === "sony-a7-iv")!;
  assert.ok(Math.abs(pixelPitchUm(a7iv) - 5.12) < 0.1); // 864 mm² / 33 MP
  assert.equal(ptpName(a7iv), "Sony ILCE-7M4");
  const links = lowLightLinks([{ c: a7iv, brandName: "Sony" }]);
  assert.ok(links[0].href.includes("photonstophotos.net/Charts/PDR.htm#") && links[0].href.includes("ILCE-7M4"));
  assert.ok(links[1].href.includes("/Charts/RN_ADU.htm#"));
  const unmeasured = lowLightLinks([{ c: { ...a7iv, slug: "not-on-ptp" }, brandName: "Sony" }]);
  assert.ok(unmeasured[0].href.endsWith("/Charts/PDR.htm"));
});

test("used value: median of daily used prices once there's a week of them; months newest first", async () => {
  const { usedValue, usedByMonth } = await import("../src/lib/value");
  const days = Array.from({ length: 10 }, (_, i) => ({ day: `2026-10-${String(i + 1).padStart(2, "0")}`, used: 100000 + i * 1000, usedMid: 110000 + i * 1000, usedN: 3 }));
  assert.equal(usedValue(days.slice(0, 6)), null);
  const v = usedValue(days)!;
  assert.equal(v.value, 114500);
  assert.equal(v.days, 10);
  assert.equal(v.listings, 30);
  const months = usedByMonth([...days, { day: "2026-11-01", used: 90000 }]);
  assert.deepEqual(months.map((m) => m.month), ["2026-11", "2026-10"]);
  assert.equal(months[1].low, 100000);
});
