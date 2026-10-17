import assert from "node:assert/strict";
import { test } from "node:test";
import { isOwnLens, kitTotal, suggestKit } from "../src/lib/kit";
import { reviewLinks } from "../src/lib/reviews";
import { cam, lensFix } from "./fixtures";

const body = cam("sony-a7-iv", "sony", ["a7 IV"], { launchPriceUsd: 2499 });
const apsc = cam("sony-a6400", "sony", ["a6400"], {}, { sensorFormat: "aps-c" });
const zoomL = (slug: string, brand: string, lo: number, hi: number, extra: object = {}, specs: object = {}) =>
  lensFix(slug, brand, [slug], extra, { focalMinMm: lo, focalMaxMm: hi, maxMagnification: 0.2, ...specs });
const primeL = (slug: string, brand: string, f: number, ap: number, extra: object = {}) =>
  lensFix(slug, brand, [slug], extra, { focalMinMm: f, focalMaxMm: f, apertureMax: ap, internalZoom: null, maxMagnification: 0.15 });

const LENSES = [
  zoomL("sony-24-70-gm", "sony", 24, 70),
  zoomL("sony-24-105-g", "sony", 24, 105, {}, { apertureMax: 4 }),
  zoomL("sigma-24-70-art", "sigma", 24, 70),
  primeL("sony-50-1-8", "sony", 50, 1.8),
  primeL("sony-85-1-4-gm", "sony", 85, 1.4),
  zoomL("sony-70-200-gm", "sony", 70, 200),
  zoomL("sony-70-300-g", "sony", 70, 300, {}, { apertureMax: 4.5, apertureMaxTele: 5.6 }),
  zoomL("sony-16-35", "sony", 16, 35),
  primeL("brightin-50-1-2", "brightin", 50, 1.2), // unknown third-party maker
  lensFix("sony-e-35-1-8", "sony", ["E 35mm"], { coverage: "aps-c" }, { focalMinMm: 35, focalMaxMm: 35, apertureMax: 1.8, internalZoom: null, maxMagnification: 0.15 }),
];
const PRICES: Record<string, number> = {
  "sony-24-70-gm": 229800, "sony-24-105-g": 109800, "sigma-24-70-art": 89900, "sony-50-1-8": 24800, "sony-85-1-4-gm": 179800,
  "sony-70-200-gm": 279800, "sony-70-300-g": 119800, "sony-16-35": 139800, "brightin-50-1-2": 9900, "sony-e-35-1-8": 44800,
};
const priceOf = (s: string) => PRICES[s] ?? null;

test("a kit is a standard zoom, a fast prime and a telephoto, inside the price band", () => {
  const kit = suggestKit(body, LENSES, priceOf, 199800, "Sony");
  assert.deepEqual(kit.map((k) => k.role), ["standard-zoom", "fast-prime", "telephoto"]);
  assert.equal(kit[0].lens.slug, "sony-24-105-g"); // a 24-70 GM costs more than the body
  assert.equal(kit[1].lens.slug, "sony-50-1-8");
  assert.equal(kit[2].lens.slug, "sony-70-300-g");
  assert.match(kit[0].reason, /^Sony's own standard zoom/);
  assert.ok(kit.every((k) => k.lens.brand !== "brightin"), "only the maker or a known third party");
});

test("the same inputs give the same kit", () => {
  assert.deepEqual(suggestKit(body, LENSES, priceOf, 199800).map((k) => k.lens.slug), suggestKit(body, [...LENSES].reverse(), priceOf, 199800).map((k) => k.lens.slug));
});

test("an expensive body gets the better lenses", () => {
  const kit = suggestKit(body, LENSES, priceOf, 449800);
  assert.equal(kit[0].lens.slug, "sony-24-70-gm");
  assert.equal(kit[2].lens.slug, "sony-70-200-gm");
});

test("priced lenses win over unpriced ones", () => {
  const kit = suggestKit(body, LENSES, (s) => (s === "sony-24-105-g" ? null : priceOf(s)), 199800);
  assert.equal(kit[0].lens.slug, "sigma-24-70-art");
  assert.match(kit[0].reason, /third-party/);
});

test("no telephoto falls back to a wide", () => {
  const kit = suggestKit(body, LENSES.filter((l) => !l.slug.startsWith("sony-70")), priceOf, 199800);
  assert.equal(kit[2].role, "wide");
  assert.equal(kit[2].lens.slug, "sony-16-35");
});

test("focal ranges are read on the body: APS-C lenses never go on full frame, and get an equivalent on APS-C", () => {
  assert.ok(!suggestKit(body, LENSES, priceOf, 199800).some((k) => k.lens.slug === "sony-e-35-1-8"));
  // At the same price, the 35mm (53mm equivalent here) is nearer a normal prime than the 50mm (75mm).
  const kit = suggestKit(apsc, LENSES, (s) => (s === "sony-e-35-1-8" ? 24800 : priceOf(s)), 129900);
  const prime = kit.find((k) => k.role === "fast-prime")!;
  assert.equal(prime.lens.slug, "sony-e-35-1-8");
  assert.deepEqual(prime.eq, [53, 53]);
  assert.match(prime.reason, /53mm equivalent/);
});

test("fixed-lens cameras and manual-focus-only mounts get no kit", () => {
  assert.deepEqual(suggestKit(cam("x100", "fujifilm", ["X100"], { mount: null }), LENSES, priceOf, 100000), []);
  assert.deepEqual(suggestKit(body, LENSES.map((l) => ({ ...l, specs: { ...l.specs, autofocus: false } })), priceOf, 199800), []);
});

test("mount alliances count as the maker's own", () => {
  const s5 = cam("panasonic-s5", "panasonic", ["S5"], { mount: "l-mount" });
  assert.ok(isOwnLens(lensFix("sigma-x", "sigma", ["x"], { mounts: ["l-mount"] }), s5));
  assert.ok(!isOwnLens(lensFix("sigma-x", "sigma", ["x"]), body));
});

test("kit total adds the body and every priced lens, and counts the unpriced", () => {
  const kit = suggestKit(body, LENSES, priceOf, 199800);
  assert.deepEqual(kitTotal(199800, kit), { total: 199800 + 109800 + 24800 + 119800, missing: 0 });
  assert.deepEqual(kitTotal(null, kit).missing, 1);
});

test("review links are search links built from the product name, never DPReview/PetaPixel search", () => {
  const links = reviewLinks({ shortName: "α7 IV" }, "Sony", "camera");
  assert.ok(links.length >= 5);
  for (const l of links) {
    assert.match(l.href, /^https:\/\//);
    assert.ok(l.href.includes("Sony%20a7%20IV"), l.href);
    assert.doesNotMatch(l.href, /dpreview|petapixel/);
  }
});
