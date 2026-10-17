import assert from "node:assert/strict";
import { test } from "node:test";
import { buildIndex, compact, matchListing, plausiblePrice } from "../src/lib/matching";
import { CAMERAS } from "./fixtures";

const index = buildIndex(CAMERAS);
const slug = (title: string, extra: { gtin?: string; mpn?: string } = {}) => {
  const m = matchListing({ title, ...extra }, index);
  return m.camera ? m.camera.slug : null;
};

test("compact folds Mark/Mk spellings and α", () => {
  assert.equal(compact("Canon EOS R6 Mark II"), compact("canon eos r6 ii"));
  assert.equal(compact("R6 Mk2"), "r6ii");
  assert.equal(compact("Sony α7 IV"), "sonya7iv");
});

test("numbered generations never collide", () => {
  assert.equal(slug("Sony Alpha a7 IV Mirrorless Digital Camera Body"), "sony-a7-iv");
  assert.equal(slug("Sony a7 III Full Frame Mirrorless Camera Body"), "sony-a7-iii");
  assert.equal(slug("Nikon Z6III Mirrorless Camera Body"), "nikon-z6-iii");
  assert.equal(slug("Nikon Z 6II body only"), "nikon-z6-ii");
  assert.equal(slug("Fujifilm X100VI Digital Camera Silver"), "fujifilm-x100vi");
  assert.equal(slug("Fujifilm X100V Digital Camera Black"), "fujifilm-x100v");
});

test("a letter suffix is a different camera", () => {
  assert.equal(slug("Sony a7R IV Mirrorless Camera"), "sony-a7r-iv");
  assert.equal(slug("Sony a7CR Mirrorless Camera Silver"), "sony-a7cr");
  assert.equal(slug("Sony a7C II Mirrorless Camera Body"), "sony-a7c-ii");
  assert.equal(slug("Sony a7C Mirrorless Camera Body"), "sony-a7c");
});

test("a trailing digit or focal length is not the model", () => {
  assert.equal(slug("Canon EOS R50 Mirrorless Camera"), "canon-eos-r50");
  assert.equal(slug("Canon EOS R5 Mirrorless Camera Body"), "canon-eos-r5");
  assert.equal(slug("Nikon NIKKOR Z 50mm f/1.8 S Lens"), null);
});

test("accessories and parts are refused", () => {
  assert.equal(slug("Battery Grip for Sony a7 IV"), null);
  assert.equal(slug("SmallRig Cage for Sony a7 IV"), null);
  assert.equal(slug("Screen Protector compatible with Canon R6 Mark II"), null);
  assert.equal(slug("Sony a7 III for parts not working"), null);
  assert.equal(slug("Sony NP-FZ100 battery for a7 IV"), null);
});

test("the brand must be named for a title match", () => {
  assert.equal(slug("R5 body excellent condition"), null);
});

test("two different cameras in one title is refused, not guessed", () => {
  assert.equal(slug("Sony a7 III and a7 IV bundle"), null);
});

test("GTIN and part number win over the title", () => {
  assert.equal(slug("Mirrorless camera", { gtin: "0027242923577" }), "sony-a7-iv");
  assert.equal(slug("Mirrorless camera", { mpn: "ILCE-7M3" }), "sony-a7-iii");
  assert.equal(slug("Mirrorless camera", { mpn: "ILCE-7M4/B" }), "sony-a7-iv");
});

test("kits are flagged for interchangeable-lens bodies only", () => {
  const kit = matchListing({ title: "Sony a7 IV with 28-70mm Lens Kit" }, index);
  assert.ok(kit.camera && kit.kit);
  const body = matchListing({ title: "Sony a7 IV Body Only" }, index);
  assert.ok(body.camera && !body.kit);
  const fixed = matchListing({ title: "Fujifilm X100VI 23mm f/2 Silver" }, index);
  assert.ok(fixed.camera && !fixed.kit);
});

test("prices far below launch are refused", () => {
  const a7iv = CAMERAS[0];
  assert.equal(plausiblePrice(a7iv, "new", 2199), true);
  assert.equal(plausiblePrice(a7iv, "new", 400), false);
  assert.equal(plausiblePrice(a7iv, "used", 1400), true);
  assert.equal(plausiblePrice(a7iv, "used", 120), false);
});
