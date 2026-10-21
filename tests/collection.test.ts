// My gear: valuation, totals per currency (never converted), the sell hint,
// the value-over-time series, input parsing, storage cleaning and the
// sign-in merge; plus the build-time value series (lib/gear-values.ts).
import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanItems, COLLECTION_MAX, estimate, gainOf, mergeCollections, parsePaid, portfolioSeries, resolveSync, sellHint, totals, type GearItem, type ValuesFile } from "../src/lib/collection";
import { sampleDays, valueOnDay, valueSeries } from "../src/lib/gear-values";
import { collectionInput } from "../src/lib/community/validate";

const it = (x: Partial<GearItem>): GearItem => ({ id: "aaaaaaaa-1", slug: "sony-a7-iv", market: "us", condition: "good", paid: 150000, bought: "2026-01-01", notes: "", updatedAt: "2026-10-01T00:00:00Z", ...x });
const US: ValuesFile = { currency: "USD", day: "2026-10-21", p: { "sony-a7-iv": [180000, 249800], "ricoh-gr-iiix": [null, 119900], "old-cam": [null, null] } };
const UK: ValuesFile = { currency: "GBP", day: "2026-10-21", p: { "sony-a7-iv": [140000, 199900] } };

test("estimate: typical used first, lowest new as the fallback, none for faulty gear", () => {
  assert.deepEqual(estimate(it({}), US), { value: 180000, basis: "used" });
  assert.deepEqual(estimate(it({ slug: "ricoh-gr-iiix" }), US), { value: 119900, basis: "new" });
  assert.deepEqual(estimate(it({ slug: "old-cam" }), US), { value: null, basis: null });
  assert.deepEqual(estimate(it({ condition: "parts" }), US), { value: null, basis: null });
  assert.deepEqual(estimate(it({}), null), { value: null, basis: null });
});

test("gain and totals stay per currency", () => {
  assert.deepEqual(gainOf(150000, 180000), { abs: 30000, pct: 20 });
  assert.equal(gainOf(null, 1), null);
  const t = totals([it({}), it({ id: "bbbbbbbb-2", slug: "ricoh-gr-iiix", paid: null }), it({ id: "cccccccc-3", market: "uk", paid: 120000 })], { us: US, uk: UK });
  const usd = t.find((x) => x.currency === "USD")!;
  const gbp = t.find((x) => x.currency === "GBP")!;
  assert.equal(usd.value, 180000 + 119900);
  assert.equal(usd.gain, 30000); // only items with a price paid count toward the gain
  assert.equal(usd.items, 2);
  assert.equal(gbp.value, 140000);
  assert.equal(gbp.gain, 20000);
  assert.deepEqual(gbp.markets, ["uk"]);
});

test("sell hint: only when the typical used price is above what was paid", () => {
  assert.match(sellHint(it({}), estimate(it({}), US)) ?? "", /\$300 above what you paid \(\+20%\)/);
  assert.equal(sellHint(it({ paid: 200000 }), estimate(it({}), US)), null);
  assert.equal(sellHint(it({ slug: "ricoh-gr-iiix", paid: 1000 }), estimate(it({ slug: "ricoh-gr-iiix" }), US)), null, "never off a new price");
  assert.equal(sellHint(it({ paid: null }), estimate(it({}), US)), null);
});

test("portfolio series: items count from the day bought, at the value that day", () => {
  const s = portfolioSeries([it({ bought: "2026-10-02" }), it({ id: "bbbbbbbb-2", slug: "ricoh-gr-iiix", bought: null, paid: 100000 })], {
    "sony-a7-iv": { currency: "USD", s: [["2026-10-01", 170000], ["2026-10-03", 175000]] },
    "ricoh-gr-iiix": { currency: "USD", s: [["2026-10-01", 110000], ["2026-10-02", 111000]] },
  });
  assert.deepEqual(s, [
    { day: "2026-10-01", value: 110000, paid: 100000 },
    { day: "2026-10-02", value: 111000 + 170000, paid: 250000 },
    { day: "2026-10-03", value: 111000 + 175000, paid: 250000 },
  ]);
  assert.deepEqual(portfolioSeries([it({ condition: "parts" })], { "sony-a7-iv": { currency: "USD", s: [["2026-10-01", 1]] } }), []);
});

test("price paid parsing", () => {
  assert.equal(parsePaid("1,299.50"), 129950);
  assert.equal(parsePaid("£1299"), 129900);
  assert.equal(parsePaid(" "), null);
  assert.equal(parsePaid("12.345"), undefined);
  assert.equal(parsePaid("abc"), undefined);
  assert.equal(parsePaid("99999999"), undefined);
});

test("stored lists are cleaned, and merging keeps the newer edit of each item", () => {
  const raw = [it({}), { id: "x" }, it({ id: "dddddddd-4", market: "zz" as never }), it({ id: "eeeeeeee-5", paid: -5, bought: "2026-02-30" }), "junk"];
  const c = cleanItems(raw);
  assert.deepEqual(c.map((x) => x.id), ["aaaaaaaa-1", "eeeeeeee-5"]);
  assert.equal(c[1].paid, null);
  assert.equal(c[1].bought, null);
  assert.deepEqual(cleanItems([it({})], (s) => s !== "sony-a7-iv"), []);
  const older = it({ notes: "old", updatedAt: "2026-10-01T00:00:00Z" });
  const newer = it({ notes: "new", updatedAt: "2026-10-05T00:00:00Z" });
  assert.equal(mergeCollections([newer], [older])[0].notes, "new");
  assert.equal(mergeCollections([older], [newer])[0].notes, "new");
});

test("sign-in sync: a browser that synced before takes the account's list; a new one adds its items once", () => {
  const local = [it({ id: "local0001" })];
  const remote = [it({ id: "remote001" })];
  assert.deepEqual(resolveSync(local, remote, "yves", "yves"), { items: remote, push: false });
  const first = resolveSync(local, remote, "", "yves");
  assert.equal(first.push, true);
  assert.deepEqual(first.items.map((x) => x.id).sort(), ["local0001", "remote001"]);
  assert.deepEqual(resolveSync([], remote, "", "yves"), { items: remote, push: false });
  assert.ok(COLLECTION_MAX >= 100);
});

test("collection input: the API's schema", () => {
  assert.ok(collectionInput.safeParse({ items: [it({})] }).success);
  assert.ok(!collectionInput.safeParse({ items: [it({ paid: 1.5 })] }).success);
  assert.ok(!collectionInput.safeParse({ items: [it({ bought: "yesterday" })] }).success);
  assert.ok(!collectionInput.safeParse({ items: [it({ condition: "mint" as never })] }).success);
});

test("value series: daily lately, weekly before; typical used once it exists, else that day's new", () => {
  const days = Array.from({ length: 60 }, (_, i) => new Date(Date.UTC(2026, 7, 1) + i * 86_400_000).toISOString().slice(0, 10));
  const sampled = sampleDays(days);
  assert.equal(sampled.at(-1), days.at(-1));
  assert.ok(sampled.includes(days[59 - 27]), "daily for the last 28 days");
  assert.ok(!sampled.includes(days[59 - 29]) && sampled.includes(days[59 - 28]) && sampled.includes(days[59 - 35]), "weekly before");
  const h = days.slice(0, 10).map((day, i) => ({ day, new: 100000 + i, ...(i >= 2 ? { used: 80000, usedMid: 80000 } : {}) }));
  assert.equal(valueOnDay(h, days[0]), 100000, "no used yet: that day's new");
  assert.equal(valueOnDay(h, days[9]), 80000, "a week of used prices: typical used");
  assert.equal(valueOnDay(h, "2020-01-01"), null);
  assert.equal(valueSeries(h, [days[0], days[9]]).length, 2);
});
