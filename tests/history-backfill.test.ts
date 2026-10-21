import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { decodeHistory, encodeHistory } from "../src/lib/history-chart";
import { buildIndex } from "../src/lib/matching";
import { mergeArchivedHistory, type ChartDay } from "../src/lib/offers";
import { readArchiveFile, readArchiveMarket, writeArchiveFile } from "../src/lib/price-history-archive";
import { decodeEntities, listingsFromHtml, listingsFromShopify, mergePoints, parseCdx, snapshotKind, snapshotPrices, surtPrefix, tsDay, waybackRawUrl } from "../src/lib/price-history-backfill";
import { inRange, priceVerdict, seriesStats } from "../src/lib/value";
import { convertAt, rowBest, type WorldRow } from "../src/lib/world-table";
import { CAMERAS, LENSES } from "./fixtures";

const index = buildIndex(CAMERAS, LENSES);
const shop = { conditions: ["new", "used"] as ("new" | "used")[], shopify: { base: "https://x.example" } };

test("archived products.json goes through the live matching: kits, accessories and implausible prices refused", () => {
  const body = {
    products: [
      { title: "Sony a7 IV Body", product_type: "Cameras", tags: [], variants: [{ title: "Default Title", price: "2299.00", available: true }] },
      { title: "Sony a7 IV + 28-70mm Kit", variants: [{ title: "Default Title", price: "2599.00", available: true }] },
      { title: "Sony a7 IV Used", tags: ["used"], variants: [{ title: "Default Title", price: "1650.00", available: true }] },
      { title: "Battery grip for Sony a7 IV", variants: [{ title: "Default Title", price: "99.00", available: true }] },
      { title: "Sony a7 III Body", variants: [{ title: "Default Title", price: "50.00", available: true }] },
      { title: "Nikon Z6III Body", variants: [{ title: "Default Title", price: "2399.00", available: false }] },
    ],
  };
  const prices = snapshotPrices(listingsFromShopify(body, "USD", shop), index, "USD", shop);
  assert.deepEqual(Object.fromEntries(prices), { "sony-a7-iv": { new: 229900, used: 165000 } });
});

test("a product .js body is in cents, a .json body in units", () => {
  const js = { title: "Sony a7 IV Body", variants: [{ title: "Default Title", price: 229900, available: true }] };
  assert.equal(listingsFromShopify(js, "USD", shop, true)[0].price, 229900);
  const json = { product: { title: "Sony a7 IV Body", variants: [{ title: "Default Title", price: "2299.00" }] } };
  const l = listingsFromShopify(json, "USD", shop);
  assert.equal(l[0].price, 229900);
  assert.equal(l[0].inStock, null); // the page didn't say: counted, not refused
});

test("JSON-LD pages: hex entities decoded, other currencies refused", () => {
  assert.equal(decodeEntities("Sony&#x20;a7&#x20;IV&#x20;&#x7C;&#x20;Secondhand"), "Sony a7 IV | Secondhand");
  const page = (name: string, cur: string) =>
    `<script type="application/ld+json">{"@type":"Product","name":"${name}","offers":{"@type":"Offer","price":"2199.00","priceCurrency":"${cur}","availability":"https://schema.org/InStock"}}</script>`;
  const used = listingsFromHtml(page("Sony&#x20;a7&#x20;IV&#x20;&#x7C;&#x20;Secondhand", "AUD"), "https://x.example/sony-a7-iv", shop);
  assert.equal(used[0].condition, "used");
  assert.equal(snapshotPrices(used, index, "AUD", shop).get("sony-a7-iv")?.used, 219900);
  assert.equal(snapshotPrices(listingsFromHtml(page("Sony a7 IV", "USD"), "https://x.example/a", shop), index, "AUD", shop).size, 0);
});

test("CDX rows, SURT keys, snapshot URLs and kinds", () => {
  const rows = parseCdx([["timestamp", "original", "mimetype", "statuscode", "digest"], ["20240317120000", "https://x.example/products.json?page=2", "application/json", "200", "ABC"]]);
  assert.equal(rows[0].original, "https://x.example/products.json?page=2");
  assert.equal(tsDay(rows[0].ts), "2024-03-17");
  assert.equal(waybackRawUrl(rows[0].ts, rows[0].original), "https://web.archive.org/web/20240317120000id_/https://x.example/products.json?page=2");
  assert.equal(surtPrefix("www.teds.com.au", "/products/"), "au,com,teds)/products/");
  assert.equal(snapshotKind("https://x.example/products.json?page=3"), "products-json");
  assert.equal(snapshotKind("https://x.example/products/sony-a7-iv.js"), "product-js");
  assert.equal(snapshotKind("https://x.example/products/sony-a7-iv.json"), "product-json");
  assert.equal(snapshotKind("https://x.example/sony-a7-iv"), "page");
  assert.equal(snapshotKind("https://x.example/logo.png"), null);
});

test("merging keeps one point per day and store, the lower price of each", () => {
  const p = (day: string, store: string, n?: number, u?: number) => ({ day, store, source: "archive" as const, snapshotUrl: "https://web.archive.org/web/1/x", ...(n ? { new: n } : {}), ...(u ? { used: u } : {}) });
  const out = mergePoints([p("2024-01-02", "teds", 200000)], [p("2024-01-02", "teds", 190000, 150000), p("2024-01-01", "georges", 210000)]);
  assert.deepEqual(
    out.map((x) => [x.day, x.store, x.new, x.used]),
    [
      ["2024-01-01", "georges", 210000, undefined],
      ["2024-01-02", "teds", 190000, 150000],
    ],
  );
});

test("archive files round-trip", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arch-"));
  writeArchiveFile({ slug: "sony-a7-iv", market: "au", currency: "AUD", points: [{ day: "2024-01-01", new: 299900, store: "teds", source: "archive", snapshotUrl: "https://web.archive.org/web/20240101000000/https://x.example/a" }] }, dir);
  assert.equal(readArchiveFile("au", "sony-a7-iv", dir)?.points[0].new, 299900);
  assert.equal(readArchiveMarket("au", dir).size, 1);
  assert.equal(readArchiveFile("au", "nope", dir), null);
});

test("recorded history wins over archived on the same day; archived days are labelled with the cheapest store", () => {
  const days = mergeArchivedHistory(
    [{ day: "2026-10-20", new: 250000 }],
    [
      { day: "2026-10-20", new: 100000, store: "teds", source: "archive", snapshotUrl: "https://e.example/1" },
      { day: "2025-05-01", new: 260000, store: "teds", source: "archive", snapshotUrl: "https://e.example/2" },
      { day: "2025-05-01", new: 255000, used: 190000, store: "georges", source: "archive", snapshotUrl: "https://e.example/3" },
    ],
  );
  assert.deepEqual(days, [
    { day: "2025-05-01", new: 255000, newAt: "georges", used: 190000, usedAt: "georges", archived: true },
    { day: "2026-10-20", new: 250000, archived: false },
  ]);
});

test("the chart file round-trips and names stores once", () => {
  const days: ChartDay[] = [
    { day: "2025-01-01", new: 1000, newAt: "teds", archived: true },
    { day: "2025-01-02", new: 900, newAt: "teds", used: 700, usedAt: "georges", archived: false },
  ];
  const h = encodeHistory("AUD", days, { day: "2025-01-02", new: { price: 900, store: "teds" }, used: null }, (k) => k.toUpperCase());
  assert.deepEqual(h.s, ["TEDS", "GEORGES"]);
  const back = decodeHistory(JSON.parse(JSON.stringify(h)));
  assert.equal(back.days[0].archived, true);
  assert.equal(back.days[1].usedAt, "GEORGES");
  assert.equal(back.today.newAt, "TEDS");
});

const series = (vals: number[], start = "2026-01-01"): ChartDay[] => vals.map((v, i) => ({ day: new Date(Date.parse(start) + i * 86400_000).toISOString().slice(0, 10), new: v, archived: false }));

test("verdict: lower than most of the window, lowest, higher, or not enough history", () => {
  const d = series([100, 110, 120, 130, 140, 150, 160, 170, 180, 190]);
  const last = d[d.length - 1].day;
  assert.equal(priceVerdict(d, 115, "new", last).headline, "Lower than 80% of the last 6 months");
  assert.equal(priceVerdict(d, 115, "new", last).tone, "good");
  assert.equal(priceVerdict(d, 90, "new", last).headline, "The lowest price in the last 6 months");
  assert.equal(priceVerdict(d, 185, "new", last).headline, "Higher than 90% of the last 6 months");
  assert.equal(priceVerdict(d, 185, "new", last).tone, "high");
  assert.equal(priceVerdict(series([100, 120]), 110, "new", "2026-01-02").tone, "unknown");
  assert.equal(priceVerdict(d, null, "new", last).tone, "unknown");
});

test("stats and ranges", () => {
  const d = series([300, 100, 200]);
  const s = seriesStats(d, "new")!;
  assert.equal(s.low.value, 100);
  assert.equal(s.high.value, 300);
  assert.equal(s.typical, 200);
  assert.equal(inRange(series(Array(100).fill(1)), "1M", "2026-04-10").length, 32);
});

test("world table: conversion, cheapest market and saving vs US list", () => {
  const rates = { USD: 1, GBP: 0.8, AUD: 1.5, EUR: 0.9, SGD: 1.3 };
  assert.equal(convertAt(150000, "AUD", "USD", rates), 100000);
  const row: WorldRow = {
    slug: "x",
    path: "/lenses/x",
    name: "X",
    listUsd: 2000,
    cells: { us: { price: 189900, currency: "USD", store: "B&H" }, au: { price: 240000, currency: "AUD", store: "Ted's" }, uk: null },
  };
  const best = rowBest(row, "USD", rates)!;
  assert.equal(best.key, "au");
  assert.equal(Math.round(best.saving!), 40000);
  assert.equal(best.pct, 20);
  assert.equal(rowBest({ ...row, cells: {} }, "USD", rates), null);
});
