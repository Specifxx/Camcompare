import assert from "node:assert/strict";
import { test } from "node:test";
import { SPEC_GROUPS, compareRows, keyDifferences, videoWidth } from "../src/lib/specs/definitions";
import { cam } from "./fixtures";

const a = cam("a", "sony", ["Alpha"], {}, { megapixels: 33, weightG: 658, ibis: true, ibisStops: 5.5, videoMaxRes: "4K" });
const b = cam("b", "canon", ["Bravo"], {}, { megapixels: 24.2, weightG: 670, ibis: true, ibisStops: 8, videoMaxRes: "6K" });
const row = (key: string, cams = [a, b]) => SPEC_GROUPS.flatMap((g) => compareRows(cams, g)).find((r) => r.def.key === key)!;

test("higher-is-better and lower-is-better pick the right column", () => {
  assert.deepEqual(row("megapixels").cells.map((c) => c.win), [true, false]);
  assert.deepEqual(row("weightG").cells.map((c) => c.win), [true, false]);
  assert.deepEqual(row("ibis").cells.map((c) => c.win), [false, true]);
  assert.deepEqual(row("videoMaxRes").cells.map((c) => c.win), [false, true]);
});

test("ties and unknowns mark nobody", () => {
  assert.deepEqual(row("isoRange").cells.map((c) => c.win), [false, false]);
  assert.equal(row("isoRange").allSame, true);
  const unknown = cam("c", "nikon", ["Charlie"], {}, { megapixels: 24.2, weightG: null });
  assert.deepEqual(row("weightG", [b, unknown]).cells.map((c) => c.win), [false, false]);
  assert.equal(row("weightG", [b, unknown]).cells[1].text, null);
});

test("descriptive rows never get a winner", () => {
  assert.deepEqual(row("afPoints", [cam("x", "sony", ["X"], {}, { afPoints: 759 }), cam("y", "sony", ["Y"], {}, { afPoints: 1053 })]).cells.map((c) => c.win), [false, false]);
});

test("video widths rank 6.2K above 6K above 4K", () => {
  assert.ok(videoWidth("6.2K")! > videoWidth("6K")! && videoWidth("6K")! > videoWidth("4K")! && videoWidth("4K")! > videoWidth("1080p")!);
});

test("key differences name the better camera with both values", () => {
  const d = keyDifferences(a, b, SPEC_GROUPS);
  assert.ok(d.includes("Resolution: 33 MP on the Alpha, against 24.2 MP on the Bravo."), d.join("\n"));
});

import { LENS_SPEC_GROUPS, cropFactor, equivalentLabel, lensCategories } from "../src/lib/specs/lens";
import { lensFix } from "./fixtures";

test("lens categories come from the 35mm-equivalent range", () => {
  const ff2470 = lensFix("a", "sony", ["A"]);
  assert.deepEqual(lensCategories(ff2470).sort(), ["standard", "wide"]);
  const apsc56 = lensFix("b", "sigma", ["B"], { coverage: "aps-c", mounts: ["sony-e"] }, { focalMinMm: 56, focalMaxMm: 56, apertureMax: 1.4, internalZoom: null });
  assert.deepEqual(lensCategories(apsc56), ["telephoto"]);
  assert.equal(equivalentLabel(apsc56), "84mm equivalent");
  const canon = lensFix("c", "canon", ["C"], { coverage: "aps-c", mounts: ["canon-rf"] }, { focalMinMm: 10, focalMaxMm: 18 });
  assert.equal(cropFactor(canon), 1.6);
  const macro = lensFix("d", "sony", ["D"], {}, { focalMinMm: 90, focalMaxMm: 90, maxMagnification: 1, internalZoom: null });
  assert.ok(lensCategories(macro).includes("macro"));
});

test("brighter aperture and lighter lens win; primes and zooms compare", () => {
  const a = lensFix("a", "sony", ["A"], {}, { apertureMax: 2.8, weightG: 695 });
  const b = lensFix("b", "sigma", ["B"], {}, { apertureMax: 2.8, weightG: 735 });
  const rows = LENS_SPEC_GROUPS.flatMap((g) => compareRows([a, b], g));
  assert.deepEqual(rows.find((r) => r.def.key === "weightG")!.cells.map((c) => c.win), [true, false]);
  assert.deepEqual(rows.find((r) => r.def.key === "aperture")!.cells.map((c) => c.win), [false, false]);
});
