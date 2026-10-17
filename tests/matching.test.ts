import assert from "node:assert/strict";
import { test } from "node:test";
import { buildIndex, compact, matchListing, mountInTitle, plausiblePrice } from "../src/lib/matching";
import { CAMERAS, LENSES } from "./fixtures";

const index = buildIndex(CAMERAS, LENSES);
const slug = (title: string, extra: { gtin?: string; mpn?: string } = {}, want?: "camera" | "lens") => {
  const m = matchListing({ title, ...extra }, index, want);
  return m.product ? m.product.slug : null;
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
  assert.equal(slug("Nikon NIKKOR Z 50mm f/1.8 S Lens"), "nikon-z-50mm-f1-8-s");
});

test("camera accessories and parts are refused", () => {
  assert.equal(slug("Battery Grip for Sony a7 IV"), null);
  assert.equal(slug("SmallRig Cage for Sony a7 IV"), null);
  assert.equal(slug("Screen Protector compatible with Canon R6 Mark II"), null);
  assert.equal(slug("Sony a7 III for parts not working"), null);
  assert.equal(slug("Sony NP-FZ100 battery for a7 IV"), null);
});

test("film cameras that share a digital name are refused", () => {
  assert.equal(slug("Sony a7 IV 35mm film SLR"), null);
  assert.equal(slug("Fujifilm X100V Digital Camera"), "fujifilm-x100v");
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
  assert.equal(slug("Lens", { mpn: "SEL2470GM2" }), "sony-fe-24-70mm-f2-8-gm-ii");
});

test("kits are flagged for interchangeable-lens bodies only", () => {
  const kit = matchListing({ title: "Sony a7 IV with 28-70mm Lens Kit" }, index);
  assert.ok(kit.product && kit.kit);
  const body = matchListing({ title: "Sony a7 IV Body Only" }, index);
  assert.ok(body.product && !body.kit);
  const fixed = matchListing({ title: "Fujifilm X100VI 23mm f/2 Silver" }, index);
  assert.ok(fixed.product && !fixed.kit);
});

test("lens generations and series never collide", () => {
  assert.equal(slug("Sony FE 24-70mm f/2.8 GM II Lens"), "sony-fe-24-70mm-f2-8-gm-ii");
  assert.equal(slug("Sony FE 24-70mm F2.8 G Master Lens SEL2470GM"), "sony-fe-24-70mm-f2-8-gm");
  assert.equal(slug("Sony 24-70mm F2.8 GM"), "sony-fe-24-70mm-f2-8-gm");
});

test("third-party lens versions: the mount is read from the title, and must be one the lens is made for", () => {
  const e = matchListing({ title: "Sigma 24-70mm F2.8 DG DN II Art Lens for Sony E" }, index);
  assert.ok(e.product && e.product.slug === "sigma-24-70mm-f2-8-dg-dn-art-ii" && e.mount === "sony-e");
  const l = matchListing({ title: "Sigma 24-70mm f/2.8 DG DN Art II L-Mount" }, index);
  assert.ok(l.product && l.mount === "l-mount");
  assert.equal(slug("Sigma 24-70mm F2.8 DG DN II Art for Nikon F"), null);
  const x = matchListing({ title: "Sigma 56mm f/1.4 DC DN Contemporary Lens for Fujifilm X" }, index);
  assert.ok(x.product && x.mount === "fujifilm-x");
  const efm = matchListing({ title: "Sigma 56mm F1.4 DC DN Contemporary for Canon EF-M" }, index);
  assert.ok(efm.product && efm.mount === "canon-ef-m");
});

test("a camera named after 'for' is a compatibility note on a lens listing", () => {
  const m = matchListing({ title: "Sigma 56mm f/1.4 DC DN Contemporary Lens for Sony E a6400" }, index);
  assert.ok(m.product && m.kind === "lens");
});

test("lens accessories are refused", () => {
  assert.equal(slug("ALC-SH167 Lens Hood for Sony FE 24-70mm F2.8 GM II"), null);
  assert.equal(slug("82mm UV Filter for Sony FE 24-70mm f/2.8 GM II"), null);
});

test("a body with a lens is a camera kit, never a lens price", () => {
  const m = matchListing({ title: "Sony a7 IV with FE 24-70mm F2.8 GM II" }, index);
  assert.ok(m.product && m.kind === "camera" && m.kit);
  assert.equal(slug("Sony a7 IV with FE 24-70mm F2.8 GM II", {}, "lens"), null);
});

test("mountInTitle reads one mount or none", () => {
  assert.equal(mountInTitle("tamron 28-75mm di iii vxd g2 for nikon z"), "nikon-z");
  assert.equal(mountInTitle("canon ef-s 10-18mm"), "canon-ef");
  assert.equal(mountInTitle("sony fe 24-70 gm"), "sony-e");
  assert.equal(mountInTitle("panasonic lumix s 50mm"), null);
});

test("prices far below launch are refused, in any currency", () => {
  const a7iv = index.bySlug.get("sony-a7-iv")!;
  assert.equal(plausiblePrice(a7iv, "new", 2199), true);
  assert.equal(plausiblePrice(a7iv, "new", 400), false);
  assert.equal(plausiblePrice(a7iv, "used", 1400), true);
  assert.equal(plausiblePrice(a7iv, "used", 120), false);
  assert.equal(plausiblePrice(a7iv, "new", 1999, "GBP"), true);
  assert.equal(plausiblePrice(a7iv, "new", 350, "GBP"), false);
  assert.equal(plausiblePrice({ launchPriceUsd: 2499, launchPrices: { AUD: 4299 } }, "new", 3600, "AUD"), true);
});
