import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeSavedList, encodeSavedList, priceGap, shareUrl } from "../src/lib/share-link";

test("a share link keeps its own query and adds the share tags", () => {
  const u = new URL(shareUrl("https://www.camcompare.app", "/uk/cameras/sony-a7-iv?x=1", "product"));
  assert.equal(u.pathname, "/uk/cameras/sony-a7-iv");
  assert.equal(u.searchParams.get("x"), "1");
  assert.equal(u.searchParams.get("utm_source"), "share");
  assert.equal(u.searchParams.get("utm_medium"), "product");
});

test("the price gap needs two stores and a real difference", () => {
  assert.equal(priceGap([{ price: 100, store: "A" }]), null);
  assert.equal(priceGap([{ price: 100, store: "A" }, { price: 120, store: "A" }]), null);
  assert.equal(priceGap([{ price: 100, store: "A" }, { price: 100, store: "B" }]), null);
  const g = priceGap([{ price: 150, store: "B" }, { price: 0, store: "C" }, { price: 120, store: "A" }]);
  assert.deepEqual(g, { low: { price: 120, store: "A" }, high: { price: 150, store: "B" }, pct: 20 });
});

test("a shared saved list round-trips and drops junk", () => {
  const items = [{ slug: "sony-a7-iv", kind: "c" as const }, { slug: "sigma-24-70", kind: "l" as const }];
  const enc = encodeSavedList(items);
  assert.deepEqual(decodeSavedList(`?i=${enc}`), items);
  assert.deepEqual(decodeSavedList("?i=c:ok.x:bad.l:<script>"), [{ slug: "ok", kind: "c" }]);
  assert.equal(decodeSavedList("?other=1"), null);
  assert.equal(encodeSavedList(Array.from({ length: 80 }, (_, n) => ({ slug: `s${n}`, kind: "c" as const }))).split(".").length, 50);
});

// Share-for-a-deal (owner, 2026-11-18).
import { pickShareArm } from "../src/components/ShareThanks";
test("the share-for-a-deal arm is drawn once, half and half, and kept", () => {
  assert.equal(pickShareArm(null, 0.2), "reward");
  assert.equal(pickShareArm(null, 0.8), "plain");
  assert.equal(pickShareArm("reward", 0.8), "reward");
});
