import assert from "node:assert/strict";
import { test } from "node:test";
import { ALERT_MIN_FILL_MS, NOTIFY_GAP_MS, parseTarget, suggestTarget } from "../src/lib/alert-kinds";
import { checkAlertRequest, decideNotify, emailBody, isToken, lowestFor, newToken, TARGET_MAX } from "../src/lib/alerts";
import type { Offer } from "../src/lib/offers";

const ok = { email: " Me@Example.com ", slug: "sony-a7-iv", kind: "camera", market: "uk", condition: "used", target: 150000, elapsedMs: 5000, website: "" };

test("a good request is cleaned: email lowercased and trimmed, target kept", () => {
  const v = checkAlertRequest(ok);
  assert.equal(v.action, "create");
  if (v.action === "create") assert.deepEqual(v.alert, { email: "me@example.com", slug: "sony-a7-iv", kind: "camera", market: "uk", condition: "used", target: 150000 });
  const any = checkAlertRequest({ ...ok, condition: undefined, target: null });
  assert.equal(any.action, "create");
  if (any.action === "create") assert.deepEqual([any.alert.condition, any.alert.target], ["any", null]);
});

test("bad requests are refused, bots dropped", () => {
  const reject = (b: object) => assert.equal(checkAlertRequest(b).action, "reject", JSON.stringify(b));
  reject({ ...ok, email: "nope" });
  reject({ ...ok, slug: "../etc/passwd" });
  reject({ ...ok, slug: "Sony A7" });
  reject({ ...ok, kind: "tripod" });
  reject({ ...ok, market: "mars" });
  reject({ ...ok, condition: "mint" });
  reject({ ...ok, target: -5 });
  reject({ ...ok, target: 12.5 });
  reject({ ...ok, target: TARGET_MAX + 1 });
  reject({ ...ok, elapsedMs: ALERT_MIN_FILL_MS - 1 });
  reject({ ...ok, elapsedMs: undefined });
  const email = checkAlertRequest({ ...ok, email: "x@" });
  assert.ok(email.action === "reject" && /email/i.test(email.error));
  assert.deepEqual(checkAlertRequest({ ...ok, website: "spam.example" }), { action: "drop" });
});

test("tokens are random, url-safe and checked", () => {
  const a = newToken();
  assert.ok(isToken(a));
  assert.notEqual(a, newToken());
  assert.ok(!isToken("short") && !isToken(`${a.slice(0, 42)}/`) && !isToken(null));
});

test("the form's target: a bit under today, typed amounts parsed", () => {
  assert.equal(suggestTarget(199900), 189900); // 1999 * 0.95 = 1899.05 → 1899
  assert.equal(suggestTarget(null), null);
  assert.equal(parseTarget(""), null);
  assert.equal(parseTarget("1,899"), 189900);
  assert.equal(parseTarget("£1899.99"), 189999);
  assert.equal(parseTarget("A$2,100.5"), 210050);
  assert.ok(Number.isNaN(parseTarget("cheap")));
});

const NOW = Date.parse("2026-10-17T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

test("with a target: notify at or under it, never the same price twice, once a day", () => {
  const fresh = { target: 100000, lastNotifiedPrice: null, lastNotifiedAt: null };
  assert.deepEqual(decideNotify(fresh, 100001, NOW), { action: "none" });
  assert.deepEqual(decideNotify(fresh, 100000, NOW), { action: "notify", reason: "target" });
  assert.deepEqual(decideNotify(fresh, null, NOW), { action: "none" });
  const told = { target: 100000, lastNotifiedPrice: 95000, lastNotifiedAt: hoursAgo(30) };
  assert.deepEqual(decideNotify(told, 95000, NOW), { action: "none" }, "same price");
  assert.deepEqual(decideNotify(told, 97000, NOW), { action: "none" }, "higher but still under target");
  assert.deepEqual(decideNotify(told, 94000, NOW), { action: "notify", reason: "target" });
  assert.deepEqual(decideNotify({ ...told, lastNotifiedAt: hoursAgo(5) }, 90000, NOW), { action: "none" }, "inside 24h");
  assert.deepEqual(decideNotify({ ...told, lastNotifiedAt: new Date(NOW - NOTIFY_GAP_MS).toISOString() }, 90000, NOW).action, "notify");
  // Back over the target: re-arm, so the next dip under it is news again.
  assert.deepEqual(decideNotify(told, 105000, NOW), { action: "rearm" });
  const rearmed = { ...told, lastNotifiedPrice: null };
  assert.deepEqual(decideNotify(rearmed, 105000, NOW), { action: "none" });
  assert.deepEqual(decideNotify(rearmed, 96000, NOW), { action: "notify", reason: "target" });
});

test("without a target: a 3% drop from the last price, first sighting is a baseline", () => {
  assert.deepEqual(decideNotify({ target: null, lastNotifiedPrice: null, lastNotifiedAt: null }, 200000, NOW), { action: "baseline", price: 200000 });
  const base = { target: null, lastNotifiedPrice: 200000, lastNotifiedAt: null };
  assert.deepEqual(decideNotify(base, 194001, NOW), { action: "none" }, "under 3%");
  assert.deepEqual(decideNotify(base, 194000, NOW), { action: "notify", reason: "drop" });
  assert.deepEqual(decideNotify(base, 210000, NOW), { action: "none" }, "a rise");
  assert.deepEqual(decideNotify({ ...base, lastNotifiedAt: hoursAgo(2) }, 150000, NOW), { action: "none" }, "inside 24h");
});

const offer = (o: Partial<Offer>): Offer => ({ product: "x", kind: "camera", retailer: "wex", condition: "new", price: 1000, currency: "GBP", url: "https://example.com/x", title: "X", seller: null, inStock: true, kit: false, mount: null, seenAt: "2026-10-17T00:00:00Z", sourceId: null, ...o });

test("the alert's price: cheapest in-stock body for its condition", () => {
  const offers = [offer({ price: 1000 }), offer({ price: 900, kit: true }), offer({ price: 800, inStock: false }), offer({ condition: "used", price: 700 }), offer({ condition: "refurbished", price: 750 })];
  assert.equal(lowestFor(offers, "new")?.price, 1000);
  assert.equal(lowestFor(offers, "used")?.price, 700);
  assert.equal(lowestFor(offers, "any")?.price, 700);
  assert.equal(lowestFor([], "any"), null);
});

test("email HTML escapes what it shows", () => {
  const { text, html } = emailBody({ lines: ["<b>Sony</b> & co"], button: { label: "Go", url: "https://www.camcompare.app/x?a=1&b=2" }, footer: ["Stop: https://www.camcompare.app/stop"] });
  assert.ok(html.includes("&lt;b&gt;Sony&lt;/b&gt; &amp; co"));
  assert.ok(html.includes('href="https://www.camcompare.app/x?a=1&amp;b=2"'));
  assert.ok(text.includes("Go: https://www.camcompare.app/x?a=1&b=2"));
});
