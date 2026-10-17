import assert from "node:assert/strict";
import { test } from "node:test";
import { checkedAgo } from "../src/components/home/checked-ago";
import { homeDeals, homeDealViews, type HomeDealInput } from "../src/lib/deals-home";
import type { Offer } from "../src/lib/offers";

const offer = (o: Partial<Offer> & Pick<Offer, "price">): Offer => ({
  product: "x",
  kind: "camera",
  retailer: "bh",
  condition: "used",
  currency: "USD",
  url: "https://example.com/p",
  title: "t",
  seller: null,
  inStock: true,
  kit: false,
  mount: null,
  seenAt: "2026-10-17T00:00:00Z",
  sourceId: null,
  ...o,
});
const item = (slug: string, rrpMinor: number | null, offers: Offer[], kind: "camera" | "lens" = "camera"): HomeDealInput => ({ slug, kind, rrpMinor, offers });

test("ranks by the saving of the cheapest used offer against RRP", () => {
  const d = homeDeals([
    item("a", 100000, [offer({ price: 80000 }), offer({ price: 70000, condition: "refurbished", retailer: "adorama" })]),
    item("b", 300000, [offer({ price: 200000 })]),
    item("c", 50000, [offer({ price: 10000 })]),
  ], "used");
  assert.deepEqual(d.map((x) => [x.slug, x.save, x.pct]), [["b", 100000, 33], ["c", 40000, 80], ["a", 30000, 30]]);
  assert.equal(d[2].condition, "refurbished");
  assert.equal(d[2].retailer, "adorama");
});

test("only in-stock, body-only, non-Amazon offers count", () => {
  const d = homeDeals([
    item("a", 100000, [offer({ price: 10000, kit: true }), offer({ price: 20000, inStock: false }), offer({ price: 30000, retailer: "amazon" }), offer({ price: 90000 })]),
  ], "used");
  assert.equal(d[0].price, 90000);
  assert.deepEqual(homeDeals([item("a", 100000, [offer({ price: 30000, retailer: "amazon" })])], "used"), []);
});

test("skips products without an RRP and savings under 5%", () => {
  const d = homeDeals([
    item("none", null, [offer({ price: 10 })]),
    item("zero", 0, [offer({ price: 10 })]),
    item("small", 100000, [offer({ price: 96000 })]),
    item("over", 100000, [offer({ price: 120000 })]),
    item("ok", 100000, [offer({ price: 95000 })]),
  ], "used");
  assert.deepEqual(d.map((x) => x.slug), ["ok"]);
});

test("new mode reads new offers and carries the used price beside it", () => {
  const d = homeDeals([item("a", 100000, [offer({ price: 85000, condition: "new" }), offer({ price: 60000 })])], "new");
  assert.equal(d[0].condition, "new");
  assert.equal(d[0].price, 85000);
  assert.equal(d[0].other, 60000);
  assert.equal(homeDeals([item("a", 100000, [offer({ price: 85000, condition: "new" }), offer({ price: 60000 })])], "used")[0].other, 85000);
});

test("one row per product, filters by kind, caps the list", () => {
  const d = homeDeals([item("a", 100000, [offer({ price: 90000 })]), item("a", 100000, [offer({ price: 50000 })]), item("l", 100000, [offer({ price: 70000 })], "lens")], "used");
  assert.deepEqual(d.map((x) => [x.slug, x.price]), [["a", 50000], ["l", 70000]]);
  assert.deepEqual(homeDeals(d.map((x) => item(x.slug, 100000, [offer({ price: x.price })], x.kind)), "used", { kind: "lens" }).map((x) => x.slug), ["l"]);
  const many = Array.from({ length: 40 }, (_, i) => item(`p${i}`, 100000, [offer({ price: 10000 + i * 1000 })]));
  assert.equal(homeDeals(many, "used").length, 24);
  assert.equal(homeDeals(many, "used", { max: 3 }).length, 3);
});

test("the tab views hold each view's top list, in rank order", () => {
  const cams = Array.from({ length: 5 }, (_, i) => item(`c${i}`, 100000, [offer({ price: 10000 + i * 1000 })]));
  const lenses = Array.from({ length: 3 }, (_, i) => item(`l${i}`, 100000, [offer({ price: 50000 + i * 1000 })], "lens"));
  const v = homeDealViews([...cams, ...lenses], "used", 4);
  assert.deepEqual(v.filter((d) => d.inAll).map((d) => d.slug), ["c0", "c1", "c2", "c3"]);
  assert.deepEqual(v.filter((d) => d.kind === "camera").map((d) => d.slug), ["c0", "c1", "c2", "c3"]);
  assert.deepEqual(v.filter((d) => d.kind === "lens").map((d) => d.slug), ["l0", "l1", "l2"]);
});

test("freshness reads like a person wrote it", () => {
  const now = Date.parse("2026-10-17T12:00:00Z");
  assert.equal(checkedAgo(null, now), null);
  assert.equal(checkedAgo("nope", now), null);
  assert.equal(checkedAgo("2026-10-17T11:59:30Z", now), "just now");
  assert.equal(checkedAgo("2026-10-17T11:20:00Z", now), "40 minutes ago");
  assert.equal(checkedAgo("2026-10-17T11:00:00Z", now), "1 hour ago");
  assert.equal(checkedAgo("2026-10-17T07:00:00Z", now), "5 hours ago");
  assert.equal(checkedAgo("2026-10-14T12:00:00Z", now), "3 days ago");
});
