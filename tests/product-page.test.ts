import assert from "node:assert/strict";
import { test } from "node:test";
import { camera } from "../src/lib/catalog";
import type { Fx } from "../src/lib/fx";
import { worldRows, worldVerdict } from "../src/lib/insights";
import { productLd } from "../src/lib/jsonld";
import type { MarketCode } from "../src/lib/markets";
import { offerRows, quickViewData } from "../src/lib/offer-rows";
import { rowInTab, tabHideClass } from "../src/lib/offer-tabs";
import type { Offer } from "../src/lib/offers";
import { headline, kitText, lensesInTitle, percentOff, priceSentence, typicalRange } from "../src/lib/price-rules";
import { reviewTopics, topicTone } from "../src/lib/review-topics";
import { cameraThings, lineSiblings } from "../src/lib/things-to-know";
import { discussionLinks, subreddits, videoLinks } from "../src/lib/media-links";
import { cam } from "./fixtures";

const fx: Fx = { date: "2026-10-21", rates: { USD: 1, GBP: 0.75, EUR: 0.9, AUD: 1.5, SGD: 1.3 } };
const none = { us: [], uk: [], eu: [], au: [], sg: [] } as Record<MarketCode, Offer[]>;

const o = (retailer: string, price: number, x: Partial<Offer> = {}): Offer => ({
  product: "canon-eos-r50", kind: "camera", retailer, condition: "new", price, currency: "AUD", url: `https://example.com/${retailer}/${price}/${x.sourceId ?? ""}`,
  title: "Canon EOS R50 Body", seller: null, inStock: true, kit: false, mount: null, seenAt: "2026-10-21T06:00:00Z", sourceId: `${retailer}-${price}-${Math.random()}`, ...x,
});

// What the owner photographed on /au/cameras/canon-eos-r50: Cash Converters used A$799 twice,
// Camera Electronic new with a lens A$1,078.99 and A$1,316.99, and no body-only price at all.
const R50_AU: Offer[] = [
  o("cash-converters-au", 79900, { condition: "used", kit: true, title: "Canon Eos R50 Aps-C Rf-S 18-45mm F/4.5-6.3 Is Stm Kit", sourceId: "cc-1" }),
  o("cash-converters-au", 79900, { condition: "used", kit: true, title: "Canon Eos R50 Aps-C Rf-S 18-45mm F/4.5-6.3 Is Stm Kit", sourceId: "cc-2" }),
  o("camera-electronic", 107899, { kit: true, title: "Canon EOS R50 Mirrorless Camera with RF-S 18-45mm IS STM f/4.5-6.3 Lens", sourceId: "ce-1" }),
  o("camera-electronic", 131699, { kit: true, title: "Canon EOS R50 Mirrorless Camera with RF-S 18-45mm IS STM & RF-S 55-210mm Lenses", sourceId: "ce-2" }),
];
const R50_US: Offer[] = [o("abt", 72900, { currency: "USD", sourceId: "abt" }), o("focus-camera", 58499, { currency: "USD", condition: "used", inStock: false, sourceId: "fc" })];
const R50_UK: Offer[] = [o("harrison-cameras", 62900, { currency: "GBP", sourceId: "h1" }), o("harrison-cameras", 54500, { currency: "GBP", condition: "used", sourceId: "h2" })];

test("R50 in Australia: kits only is never 'not priced'; every claim follows the same rule", () => {
  const h = headline(R50_AU);
  assert.equal(h.new, null);
  assert.equal(h.used, null);
  assert.equal(h.kit?.price, 107899); // a new kit leads; never as the body price
  assert.equal(kitText(h.kit!), "Kit with RF-S 18-45mm");

  const rows = worldRows({ ...none, us: R50_US, uk: R50_UK, au: R50_AU }, "au", fx, (x) => kitText(x));
  const au = rows.find((r) => r.market === "au")!;
  assert.equal(au.new, null);
  assert.deepEqual(au.newKit, { price: 107899, here: 107899, label: "Kit with RF-S 18-45mm" });
  assert.equal(au.usedKit?.price, 79900); // used shown, as a kit
  assert.equal(au.listed, true);
  const v = worldVerdict(rows, "au")!;
  assert.doesNotMatch(v.text, /not priced/i);
  assert.match(v.text, /^Cheapest in the US\. In Australia only kits are priced today \(from A\$1,078\.99, kit with RF-S 18-45mm\)/);

  // Quick view, metadata and structured data agree with the hero.
  const qv = quickViewData({ kind: "camera", item: camera("canon-eos-r50")! }, "au", R50_AU, null);
  assert.deepEqual(qv.from, { price: 107899, what: "kit", label: "Kit with RF-S 18-45mm" });
  assert.equal(qv.lowestNew, null);
  assert.equal(priceSentence(R50_AU, "AUD"), " Kits with a lens from A$1,078.99.");
  assert.equal(productLd(camera("canon-eos-r50")!, "camera", R50_AU, "au"), null); // no body price, no Product offer
});

test("R50 in Australia: identical listings merge, kits carry their lens, the hero's kit is tagged", () => {
  const rows = offerRows(R50_AU, { page: "p", placement: "offers", pack: "body", withAmazon: true });
  assert.equal(rows.length, 3);
  const cc = rows.find((r) => r.retailer === "cash-converters-au")!;
  assert.equal(cc.count, 2);
  assert.equal(cc.cond, "used");
  assert.equal(cc.pack, "Kit with RF-S 18-45mm");
  assert.equal(rows.find((r) => r.price === 131699)!.kitLens, "RF-S 18-45mm + RF-S 55-210mm");
  assert.deepEqual(rows.filter((r) => r.tag).map((r) => [r.price, r.tag]), [[107899, "kit"]]);
  // Filters: the used kit shows under Used and Kits, never under New.
  assert.ok(rowInTab(cc, "used") && rowInTab(cc, "kit") && rowInTab(cc, "all") && !rowInTab(cc, "new"));
  assert.equal(tabHideClass(["new", "refurb"]), "group-data-[tab=new]/o:hidden group-data-[tab=refurb]/o:hidden");
});

test("a priced market: best new and lowest used tagged, was-price, stock, promo and detail on the row", () => {
  const offers = [
    o("abt", 249900, { currency: "USD", wasPrice: 299900, availability: "low_stock", promo: "Bonus battery", detail: "Black", sourceId: "a" }),
    o("bh", 239900, { currency: "USD", availability: "preorder", sourceId: "b" }),
    o("mpb", 180000, { currency: "USD", condition: "used", detail: "Grade: like new", sourceId: "m" }),
    o("bh", 260000, { currency: "USD", kit: true, title: "Canon EOS R50 with RF-S 18-45mm", sourceId: "k" }),
  ];
  const rows = offerRows(offers, { page: "p", placement: "offers", pack: "body", withAmazon: true });
  const best = rows.find((r) => r.tag === "best")!;
  assert.equal(best.price, 239900);
  assert.equal(best.avail, "preorder");
  assert.equal(rows.find((r) => r.tag === "used")!.price, 180000);
  const abt = rows.find((r) => r.retailer === "abt")!;
  assert.deepEqual([abt.was, abt.avail, abt.promo, abt.detail], [299900, "low_stock", "Bonus battery", "Black"]);
  assert.equal(rows.find((r) => r.kit)!.tag, "kit");
  assert.equal(percentOff(225000, 300000), 25);
  assert.equal(percentOff(300000, 300000), null);
  assert.equal(percentOff(300000, null), null);
  // Different details stay apart.
  const two = offerRows([o("x", 100000, { detail: "Store A", sourceId: "1" }), o("x", 100000, { detail: "Store B", sourceId: "2" })], { page: "p", placement: "o", pack: "body", withAmazon: true });
  assert.equal(two.length, 2);
});

test("kit lenses from a listing's title, and the typical new range", () => {
  assert.deepEqual(lensesInTitle("Canon EOS R50 RF-S18-45mm F4.5-6.3 IS STM & RF-S55-210mm F5-7.1 Kit"), ["RF-S 18-45mm", "RF-S 55-210mm"]);
  assert.deepEqual(lensesInTitle("Canon EOS R50 24.2MP with 18-45mm and 2x 64GB"), ["18-45mm"]);
  assert.deepEqual(lensesInTitle("Canon EOS R50 Body"), []);
  assert.equal(kitText(o("x", 1, { kit: true, title: "R50 kit", kitLensName: "RF-S 18-45mm F4.5-6.3 IS STM" })), "Kit with RF-S 18-45mm F4.5-6.3 IS STM");
  const offers = [103900, 109900, 112900, 116900].map((p, i) => o(`s${i}`, p, { sourceId: `t${i}` }));
  const r = typicalRange(offers, [], 90, "2026-10-21")!;
  assert.ok(r.low >= 103900 && r.high <= 116900 && r.low < r.high);
  assert.equal(typicalRange(offers.slice(0, 2), [], 90, "2026-10-21"), null); // too few numbers: says nothing
});

test("what people are saying counts members' words only; tones need two thirds", () => {
  const reviews = [
    { rating: 5, body: "Great autofocus and tiny, light body." },
    { rating: 4, body: "Autofocus tracks well; battery is weak." },
    { rating: 2, body: "Battery dies fast and the grip is small." },
  ];
  const t = reviewTopics(reviews, "camera");
  const af = t.find((x) => x.key === "af")!;
  assert.equal(af.mentions, 2);
  assert.equal(topicTone(af), "good");
  assert.equal(topicTone(t.find((x) => x.key === "battery")!), "mixed");
});

test("things to know: spec facts only, nulls skipped, good-for and not-for name their spec", () => {
  const c = cam("x-cam", "sony", ["X Cam"], {}, { ibis: null, batteryShotsCipa: null, weatherSealed: false, cardSlots: 1 });
  const t = cameraThings(c, { offers: [], currency: "USD", market: "us", marketName: "the US", used: null, todayUsed: null });
  assert.ok(!t.facts.some((f) => /stabilisation|CIPA/.test(f)));
  assert.ok(t.notFor.some((f) => f.label === "Rain and dust" && f.why === "not weather sealed"));
  assert.ok(t.notFor.some((f) => f.why === "one card slot"));
  assert.ok(t.goodFor.some((f) => f.label === "Low light" && f.why === "full-frame sensor"));
  // Same line from the names: the α7 IV and the first α7; never an unpublished product (the EOS R50 V has no photo yet).
  assert.ok(lineSiblings(camera("sony-a7-iv")!, "camera").some((s) => s.slug === "sony-a7"));
  assert.ok(!lineSiblings(camera("canon-eos-r50")!, "camera").some((s) => s.slug === "canon-eos-r50-v"));
});

test("videos and discussions link to each site's own search, in the right subreddit", () => {
  const r50 = camera("canon-eos-r50")!;
  assert.deepEqual(subreddits(r50, "camera"), ["canon", "photography", "videography"]);
  assert.ok(discussionLinks(r50, "camera", "Canon").every((l) => l.href.startsWith("https://www.reddit.com/r/") || l.href.startsWith("https://www.dpreview.com/")));
  const v = videoLinks(r50, "camera", "Canon");
  assert.ok(v[0].href.includes("youtube.com/results?search_query=Canon%20EOS%20R50%20review"));
  assert.ok(v.some((l) => l.href === "https://www.youtube.com/@CanonUSA"));
});
