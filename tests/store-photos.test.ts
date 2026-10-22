// "Unofficial images" (owner, 2026-10-22): a product with no licensed
// thumbnail shows a store's own listing photo, chosen from the offers.
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Offer } from "../src/lib/offers";
import { offerImage } from "../src/lib/sources/shopify";
import { pickStorePhotos, readStorePhotos } from "../src/lib/store-photos";

const NOW = "2026-10-22T00:00:00.000Z";
const o = (x: Partial<Offer>): Offer => ({ product: "canon-eos-r6-v", kind: "camera", retailer: "georges", condition: "new", price: 499900, currency: "AUD", url: "https://www.georges.com.au/products/r6v", title: "Canon EOS R6 V Body", seller: null, inStock: true, kit: false, mount: "canon-rf", seenAt: NOW, sourceId: "1", image: "~1/0603/4083/0375/files/r6v.jpg", ...x });

test("store photo: new, body-only, in stock, never second-hand, never a kit, never Amazon", () => {
  const none = () => false;
  assert.deepEqual(pickStorePhotos([o({ condition: "used" }), o({ kit: true }), o({ inStock: false }), o({ retailer: "amazon-au" }), o({ image: undefined })], none), {});
  const got = pickStorePhotos([o({})], none);
  assert.deepEqual(got, { "canon-eos-r6-v": { src: "https://cdn.shopify.com/s/files/1/0603/4083/0375/files/r6v.jpg?width=640", store: "Georges Cameras", retailer: "georges" } });
});

test("store photo: a maker's own store, then an authorized dealer, beat other stores", () => {
  const none = () => false;
  const pick = (os: Offer[]) => pickStorePhotos(os, none)["canon-eos-r6-v"]?.retailer;
  assert.equal(pick([o({ retailer: "tk-foto", currency: "SGD" }), o({ retailer: "canon-store-sg", currency: "SGD" })]), "canon-store-sg");
  assert.equal(pick([o({ retailer: "tk-foto", currency: "SGD" }), o({ retailer: "georges" })]), "georges"); // TK Foto: authorized unknown
});

test("store photo: a licensed thumbnail always wins", () => {
  assert.deepEqual(pickStorePhotos([o({})], (s) => s === "canon-eos-r6-v"), {});
});

test("store photo file: only https photos with a store are read", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sp-")), "store-photos.json");
  fs.writeFileSync(file, JSON.stringify({ photos: { a: { src: "https://cdn.shopify.com/x.jpg", store: "Georges Cameras", retailer: "georges" }, b: { src: "javascript:alert(1)", store: "x" }, c: { src: "https://x/y.jpg" } } }));
  assert.deepEqual(Object.keys(readStorePhotos(file)), ["a"]);
});

test("offer photos kept: second-hand always, new only for a product without a licensed thumbnail, never a new kit", () => {
  const url = "https://cdn.shopify.com/s/files/1/x/r6v.jpg?v=1";
  assert.deepEqual(offerImage({ condition: "used", kit: false, product: "sony-a7-iv" }, url), { image: "~1/x/r6v.jpg" });
  assert.deepEqual(offerImage({ condition: "new", kit: false, product: "no-such-product-without-a-photo" }, url), { image: "~1/x/r6v.jpg" });
  assert.deepEqual(offerImage({ condition: "new", kit: true, product: "no-such-product-without-a-photo" }, url), {});
});
