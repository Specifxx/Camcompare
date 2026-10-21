import assert from "node:assert/strict";
import { test } from "node:test";
import { ALERT_MIN_FILL_MS, BRAND_NOTIFY_GAP_MS, EMAILS_PER_ADDRESS_RUN, NOTIFY_GAP_MS, parseTarget, STOCK_NOTIFY_GAP_MS, suggestTarget } from "../src/lib/alert-kinds";
import { runAlerts } from "../src/lib/alert-run";
import { checkAlertRequest, decideBrand, decideNotify, decideStock, emailBody, isToken, lowestFor, newToken, stockEmail, TARGET_MAX, type AlertRow, type Email } from "../src/lib/alerts";
import { releaseId, type Release } from "../src/lib/releases/core";
import type { Offer } from "../src/lib/offers";

const ok = { email: " Me@Example.com ", slug: "sony-a7-iv", kind: "camera", market: "uk", condition: "used", target: 150000, elapsedMs: 5000, website: "" };

test("a good request is cleaned: email lowercased and trimmed, target kept", () => {
  const v = checkAlertRequest(ok);
  assert.equal(v.action, "create");
  if (v.action === "create") assert.deepEqual(v.alert, { email: "me@example.com", slug: "sony-a7-iv", kind: "camera", market: "uk", condition: "used", type: "price", target: 150000 });
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

test("alert types: each subject takes only its kinds; stock and brand alerts carry no target", () => {
  const kind = (b: object) => checkAlertRequest({ ...ok, ...b });
  const restock = kind({ type: "restock" });
  assert.ok(restock.action === "create" && restock.alert.type === "restock" && restock.alert.target === null && restock.alert.condition === "used");
  const pre = kind({ type: "preorder" });
  assert.ok(pre.action === "create" && pre.alert.condition === "new", "a preorder is for new stock");
  const rel = kind({ kind: "release", slug: releaseId("https://x.example/1"), type: "preorder" });
  assert.equal(rel.action, "create");
  const brand = kind({ kind: "brand", slug: "godox", type: "brand" });
  assert.ok(brand.action === "create" && brand.alert.target === null);
  assert.equal(kind({ kind: "brand", slug: "godox", type: "price" }).action, "reject");
  assert.equal(kind({ kind: "release", slug: "r123", type: "restock" }).action, "reject");
  assert.equal(kind({ type: "brand" }).action, "reject");
  assert.equal(kind({ type: "teleport" }).action, "reject");
});

test("restock and preorder: one email per transition, re-armed when it sells out", () => {
  const at = (lastState: string | null, type: "restock" | "preorder" = "restock", lastNotifiedAt: string | null = null) => ({ type, lastState, lastNotifiedAt });
  assert.deepEqual(decideStock(at(null), "in_stock", NOW), { action: "baseline", state: "in_stock" }, "first look sends nothing");
  assert.deepEqual(decideStock(at("out"), "in_stock", NOW), { action: "notify", state: "in_stock" });
  assert.deepEqual(decideStock(at("in_stock"), "in_stock", NOW), { action: "none" }, "still in stock is not news");
  assert.deepEqual(decideStock(at("in_stock"), "out", NOW), { action: "state", state: "out" }, "re-armed");
  assert.deepEqual(decideStock(at("backorder"), "in_stock", NOW).action, "notify", "backorder to stock is a restock");
  assert.deepEqual(decideStock(at("out"), "preorder", NOW), { action: "state", state: "preorder" }, "a preorder isn't stock");
  assert.deepEqual(decideStock(at("none", "preorder"), "preorder", NOW), { action: "notify", state: "preorder" });
  assert.deepEqual(decideStock(at("preorder", "preorder"), "in_stock", NOW), { action: "state", state: "in_stock" }, "already orderable");
  assert.deepEqual(decideStock(at("out", "preorder"), "backorder", NOW), { action: "state", state: "backorder" });
  // Inside the gap the state is left alone, so the next run still sees the transition.
  assert.deepEqual(decideStock(at("out", "restock", hoursAgo(1)), "in_stock", NOW), { action: "none" });
  assert.equal(decideStock(at("out", "restock", new Date(NOW - STOCK_NOTIFY_GAP_MS).toISOString()), "in_stock", NOW).action, "notify");
});

const release = (n: number, hours: number): Release => ({ id: releaseId(`https://x.example/${n}`), brand: "godox", title: `Introducing the Godox X${n}`, url: `https://x.example/${n}`, publishedAt: hoursAgo(hours), kind: "video", products: [], isAnnouncement: true });

test("brand alerts: newer announcements than the cursor, newest first, then the cursor moves", () => {
  assert.deepEqual(decideBrand({ type: "brand", lastState: null, lastNotifiedAt: null, createdAt: hoursAgo(1) }, [release(1, 0)], NOW), { action: "baseline", cursor: hoursAgo(1) });
  const a = { type: "brand" as const, lastState: hoursAgo(10), lastNotifiedAt: null };
  assert.deepEqual(decideBrand(a, [release(1, 20)], NOW), { action: "none" }, "older than the cursor");
  const d = decideBrand(a, [release(1, 5), release(2, 1), release(3, 20)], NOW);
  assert.ok(d.action === "notify" && d.releases.length === 2 && d.releases[0].title.endsWith("X2") && d.cursor === hoursAgo(1));
  assert.equal(decideBrand({ ...a, lastNotifiedAt: hoursAgo(1) }, [release(2, 0.5)], NOW).action, "none", "inside the gap");
  assert.equal(decideBrand({ ...a, lastNotifiedAt: new Date(NOW - BRAND_NOTIFY_GAP_MS).toISOString() }, [release(2, 0.5)], NOW).action, "notify");
});

const row = (o: Partial<AlertRow>): AlertRow => ({ id: "1", createdAt: hoursAgo(100), email: "a@example.com", product: "sony-a7-iv", kind: "camera", market: "us", condition: "new", type: "restock", target: null, lastNotifiedPrice: null, lastNotifiedAt: null, lastState: "out", confirmed: true, token: "t".repeat(43), active: true, ...o });

test("a run: transitions emailed with an unsubscribe link, capped per address and per run, time-critical first", async () => {
  const sent: Email[] = [];
  const states: [string, string, boolean][] = [];
  const io = { send: async (e: Email) => void sent.push(e), setState: async (id: string, s: string, n = false) => void states.push([id, s, n]), setBaseline: async () => {}, markNotified: async () => {} };
  const inStock = [offer({ product: "sony-a7-iv", retailer: "bh", currency: "USD", inStock: true }), offer({ product: "sony-a7-iv", retailer: "ebay", currency: "USD", inStock: true, price: 1 })];
  // The catalog decides what exists; this test needs one real published slug.
  const { publishedCameras } = await import("../src/lib/catalog");
  const slug = publishedCameras()[0].slug;
  const offers = inStock.map((o) => ({ ...o, product: slug }));
  const alerts = Array.from({ length: EMAILS_PER_ADDRESS_RUN + 2 }, (_, i) => row({ id: String(i + 1), product: slug }));
  alerts.push(row({ id: "99", email: "b@example.com", product: "godox", type: "brand", kind: "brand", lastState: hoursAgo(50) }));
  const r = await runAlerts({ alerts, offersOf: () => offers, releases: [release(7, 1)], maxEmails: 90, now: NOW, io, log: () => {} });
  assert.equal(r.sent, EMAILS_PER_ADDRESS_RUN + 1, "three to a@, one brand email to b@");
  assert.equal(r.held, 2);
  const stock = sent.find((e) => e.to === "a@example.com")!;
  assert.match(stock.subject, /^Back in stock: /);
  assert.ok(stock.unsubscribeUrl && stock.text.includes(stock.unsubscribeUrl), "stop link in the email");
  assert.ok(!stock.text.includes("eBay"), "never a marketplace listing");
  assert.ok(states.filter(([, s, n]) => s === "in_stock" && n).length === EMAILS_PER_ADDRESS_RUN);
  // Held-back alerts keep their old state, so they go next run.
  assert.ok(!states.some(([id]) => id === String(EMAILS_PER_ADDRESS_RUN + 1)));
  const capped = await runAlerts({ alerts, offersOf: () => offers, releases: [], maxEmails: 1, now: NOW, io: { ...io, send: async () => {} }, log: () => {} });
  assert.equal(capped.sent, 1);
});

test("stock email names the store and what to do", () => {
  const e = stockEmail(row({ type: "preorder" }), "Sony FX5", "preorder", ["Preorder at B&H Photo: $3,899.00"]);
  assert.equal(e.subject, "Preorder open: Sony FX5");
  assert.ok(e.text.includes("Preorder at B&H Photo") && e.html.includes("Stop this alert"));
});
