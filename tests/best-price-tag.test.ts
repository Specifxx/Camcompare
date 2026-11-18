// Owner, 2026-11-18: a "Best price" row that is a plain store gets a small neutral tag, not the tint and filled tag; an affiliate
// (paid) best row keeps them; the hint shows only when the list has an eBay row.
import test from "node:test";
import assert from "node:assert/strict";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OfferRowItem } from "../src/components/OfferRows";
import { bestPriceHint, isPlainBest } from "../src/lib/best-tag";
import type { OfferRow } from "../src/lib/quickview";

// tsx compiles the components with the classic JSX transform (tsconfig "preserve"): give them React.
(globalThis as unknown as { React: typeof React }).React = React;

const row = (over: Partial<OfferRow>): OfferRow => ({
  id: "r1",
  retailer: "bhphoto",
  name: "Plain Camera Shop",
  condition: "New",
  price: 129900,
  currency: "USD",
  href: "https://shop.example.com/p",
  paid: false,
  inStock: true,
  kit: false,
  pack: null,
  seller: null,
  authorized: null,
  variant: null,
  tag: "best",
  ...over,
});
const html = (r: OfferRow, ebayHint: string | null) => renderToStaticMarkup(createElement(OfferRowItem, { row: r, product: "x", placement: "offers", ebayHint }));
const HINT = "Prices and stock change: also check eBay";

test("a plain best-price row has the small tag, no tint, no filled tag, and its price", () => {
  const out = html(row({}), bestPriceHint([{ brand: "ebay" }]));
  assert.match(out, /data-best-tag/);
  assert.match(out, />Best price</);
  assert.doesNotMatch(out, /bg-buy-soft\/40|bg-buy text-buy-fg/);
  assert.match(out, /1,?299(\.00)?/, "the price stays fully visible");
});

test("a paid best-price row keeps the tint and the filled tag", () => {
  const out = html(row({ paid: true }), HINT);
  assert.match(out, /bg-buy-soft\/40/);
  assert.match(out, /bg-buy text-buy-fg/);
  assert.doesNotMatch(out, /data-best-tag/);
});

test("the hint shows only with an eBay row, and never claims eBay is cheaper", () => {
  const withHint = html(row({}), bestPriceHint([{ brand: "ebay" }]));
  assert.match(withHint, /aria-label="Prices and stock change: also check eBay"/);
  assert.match(withHint, /title="Prices and stock change: also check eBay"/);
  assert.doesNotMatch(withHint, /cheaper/i);
  const without = html(row({}), bestPriceHint([]));
  assert.match(without, /Best price/);
  assert.doesNotMatch(without, /also check|<button/);
  assert.equal(bestPriceHint([{ brand: "amazon" }]), null);
});

test("other tags (lowest used, lowest kit) and the helper are unchanged", () => {
  assert.match(html(row({ tag: "used" }), HINT), /Lowest used/);
  assert.equal(isPlainBest({ paid: false }), true);
  assert.equal(isPlainBest({ paid: true }), false);
});
