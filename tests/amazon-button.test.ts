// The Amazon row's button is amber (owner, 2026-11-18) and the quick view carries a real "See full page" button.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { retailerButtonClass } from "../src/components/OfferRows";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

test(".btn-amazon is amber with dark ink in both themes", () => {
  assert.match(read("src/app/globals.css"), /\.btn-amazon \{ @apply btn shadow-sm border border-\[#B7791F\] bg-\[#F5A524\] text-\[#111111\] hover:bg-\[#DC8A0B\]; \}/);
});

test("Amazon's earning button is amber, eBay and stores keep the buy button, unpaid stays ghost", () => {
  assert.equal(retailerButtonClass("amazon", true), "btn-amazon");
  assert.equal(retailerButtonClass("amazon-gb", true), "btn-amazon");
  assert.equal(retailerButtonClass("ebay", true), "btn-buy");
  assert.equal(retailerButtonClass("bhphoto", true), "btn-buy");
  assert.equal(retailerButtonClass("amazon", false), "btn-ghost");
});

test("the pinned rows use retailerButtonClass for priced and unpriced Amazon links", () => {
  const src = read("src/components/OfferRows.tsx");
  assert.match(src, /placement=\{`\$\{placement\}-\$\{kind\}`\} className=\{`\$\{retailerButtonClass\(l\.retailer, l\.paid\)\}/);
});

test("the quick view has a prominent See full page button", () => {
  const src = read("src/components/QuickView.tsx");
  assert.match(src, /data-quickview-fullpage className="btn-primary min-h-11 w-full"/);
  assert.match(src, /See full page: price history and details/);
});
