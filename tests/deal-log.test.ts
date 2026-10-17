import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { HomeDealInput } from "../src/lib/deals-home";
import { dealKey, readDealLog, updateDealLog, writeDealLog, type DealLog } from "../src/lib/deal-log";
import type { Offer } from "../src/lib/offers";

const offer = (o: Partial<Offer> & Pick<Offer, "price">): Offer => ({
  product: "x",
  kind: "camera",
  retailer: "keh",
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
const item = (slug: string, rrpMinor: number | null, offers: Offer[]): HomeDealInput => ({ slug, kind: "camera", rrpMinor, offers });
const ctx = (now: string) => ({ market: "us" as const, currency: "USD" as const, now });
const T0 = "2026-10-17T00:00:00.000Z";
const T1 = "2026-10-17T03:00:00.000Z";
const K = dealKey("a7s2", "used", "keh");
const get = (log: DealLog, key = K) => log.deals.find((d) => d.key === key);

test("a new deal is logged live with firstSeen and lastSeen at the import time", () => {
  const log = updateDealLog(null, [item("a7s2", 299900, [offer({ price: 119900 })]), item("norrp", null, [offer({ price: 100 })])], ctx(T0));
  assert.equal(log.deals.length, 1);
  const d = get(log)!;
  assert.equal(d.status, "live");
  assert.equal(d.firstSeen, T0);
  assert.equal(d.lastSeen, T0);
  assert.equal(d.save, 180000);
  assert.equal(d.pct, 60);
  assert.equal(d.was, undefined);
});

test("a price drop keeps firstSeen and records the price it was", () => {
  const a = updateDealLog(null, [item("a7s2", 299900, [offer({ price: 119900 })])], ctx(T0));
  const b = updateDealLog(a, [item("a7s2", 299900, [offer({ price: 109900 })])], ctx(T1));
  const d = get(b)!;
  assert.equal(d.firstSeen, T0);
  assert.equal(d.lastSeen, T1);
  assert.equal(d.price, 109900);
  assert.equal(d.was, 119900);
  assert.equal(d.droppedAt, T1);
  // A later rise clears the "was".
  const c = updateDealLog(b, [item("a7s2", 299900, [offer({ price: 115000 })])], ctx("2026-10-17T06:00:00.000Z"));
  assert.equal(get(c)!.was, undefined);
  assert.equal(get(c)!.price, 115000);
});

test("a deal goes 'sold' when its retailer no longer has it in stock, and stays while a cheaper shop takes the top spot", () => {
  const a = updateDealLog(null, [item("a7s2", 299900, [offer({ price: 119900 })])], ctx(T0));
  // MPB undercuts: KEH's deal is still in stock, so it stays live and MPB's is added.
  const b = updateDealLog(a, [item("a7s2", 299900, [offer({ price: 119900 }), offer({ price: 99900, retailer: "mpb" })])], ctx(T1));
  assert.equal(get(b)!.status, "live");
  assert.equal(get(b, dealKey("a7s2", "used", "mpb"))!.status, "live");
  // KEH sells it.
  const c = updateDealLog(b, [item("a7s2", 299900, [offer({ price: 119900, inStock: false }), offer({ price: 99900, retailer: "mpb" })])], ctx("2026-10-17T06:00:00.000Z"));
  assert.equal(get(c)!.status, "gone");
  assert.equal(get(c)!.goneWhy, "sold");
  assert.equal(get(c)!.goneAt, "2026-10-17T06:00:00.000Z");
  assert.equal(get(c, dealKey("a7s2", "used", "mpb"))!.status, "live");
});

test("a deal priced out of deal territory is 'expired'; a relisted one is a fresh find", () => {
  const a = updateDealLog(null, [item("a7s2", 299900, [offer({ price: 119900 })])], ctx(T0));
  const b = updateDealLog(a, [item("a7s2", 299900, [offer({ price: 299000 })])], ctx(T1));
  assert.equal(get(b)!.status, "gone");
  assert.equal(get(b)!.goneWhy, "expired");
  const c = updateDealLog(b, [item("a7s2", 299900, [offer({ price: 129900 })])], ctx("2026-10-17T06:00:00.000Z"));
  assert.equal(get(c)!.status, "live");
  assert.equal(get(c)!.firstSeen, "2026-10-17T06:00:00.000Z");
  assert.equal(get(c)!.goneAt, undefined);
});

test("gone deals are dropped after seven days; Amazon and kits never count", () => {
  const a = updateDealLog(null, [item("a7s2", 299900, [offer({ price: 119900 })])], ctx(T0));
  const b = updateDealLog(a, [item("a7s2", 299900, [])], ctx(T1));
  assert.equal(get(b)!.status, "gone");
  const c = updateDealLog(b, [item("a7s2", 299900, [])], ctx("2026-10-23T03:00:00.000Z"));
  assert.ok(get(c), "still kept at six days");
  const d = updateDealLog(c, [item("a7s2", 299900, [])], ctx("2026-10-24T04:00:00.000Z"));
  assert.equal(get(d), undefined);
  const e = updateDealLog(null, [item("a7s2", 299900, [offer({ price: 99900, retailer: "amazon" }), offer({ price: 99900, kit: true })])], ctx(T0));
  assert.equal(e.deals.length, 0);
});

test("the file round-trips, one deal per line", () => {
  const log = updateDealLog(null, [item("a7s2", 299900, [offer({ price: 119900 })]), item("z", 100000, [offer({ price: 50000 })])], ctx(T0));
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "deal-log-")), "us.json");
  writeDealLog(log, file);
  assert.deepEqual(readDealLog("us", file), log);
  assert.equal(fs.readFileSync(file, "utf8").split("\n").filter((l) => l.includes('"key"')).length, 2);
});
