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

import { LENS_SPEC_GROUPS, cropFactor, cropOn, equivalentLabel, lensCategories } from "../src/lib/specs/lens";
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

test("70-200s are not standard, APS-C kit zooms are not telephoto, 20mm is ultra-wide", () => {
  const z70200 = lensFix("e", "sony", ["E"], {}, { focalMinMm: 70, focalMaxMm: 200 });
  assert.deepEqual(lensCategories(z70200), ["telephoto"]);
  const kit = lensFix("f", "sony", ["F"], { coverage: "aps-c" }, { focalMinMm: 16, focalMaxMm: 50 });
  assert.deepEqual(lensCategories(kit).sort(), ["standard", "wide"]);
  const p20 = lensFix("g", "sony", ["G"], {}, { focalMinMm: 20, focalMaxMm: 20, internalZoom: null });
  assert.deepEqual(lensCategories(p20), ["ultra-wide"]);
  const p85 = lensFix("h", "sony", ["H"], {}, { focalMinMm: 85, focalMaxMm: 85, maxMagnification: 0.12, internalZoom: null });
  assert.deepEqual(lensCategories(p85), ["telephoto"]);
});

test("on a body, a lens is what it is at that body's crop", () => {
  const z1435 = lensFix("i", "canon", ["I"], { mounts: ["canon-rf"] }, { focalMinMm: 14, focalMaxMm: 35 });
  const r7 = cam("r7", "canon", ["R7"], { mount: "canon-rf" }, { sensorFormat: "aps-c" });
  const r5 = cam("r5", "canon", ["R5"], { mount: "canon-rf" });
  assert.equal(cropOn(z1435, r7), 1.6);
  assert.ok(lensCategories(z1435, cropOn(z1435, r5)).includes("ultra-wide"));
  assert.ok(!lensCategories(z1435, cropOn(z1435, r7)).includes("ultra-wide"));
  // An APS-C lens on a full-frame body works in crop mode.
  const apsc = lensFix("j", "sony", ["J"], { coverage: "aps-c" }, { focalMinMm: 56, focalMaxMm: 56, internalZoom: null });
  assert.equal(cropOn(apsc, cam("a7", "sony", ["A7"])), 1.5);
});

test("a lens made for several sensor sizes names each equivalent", () => {
  const sigma = lensFix("k", "sigma", ["K"], { coverage: "aps-c", mounts: ["sony-e", "canon-rf", "micro-four-thirds"] }, { focalMinMm: 56, focalMaxMm: 56, internalZoom: null });
  assert.equal(cropFactor(sigma), 1.5);
  assert.equal(equivalentLabel(sigma), "84mm equivalent (90mm on Canon, 112mm on Micro Four Thirds)");
  const mft = lensFix("l", "sigma", ["L"], { coverage: "aps-c", mounts: ["micro-four-thirds"] }, { focalMinMm: 16, focalMaxMm: 16, internalZoom: null });
  assert.equal(equivalentLabel(mft), "32mm equivalent");
});

test("a zoom's aperture wins only when it is as bright at both ends", () => {
  const ap = (slug: string, w: number, t: number | null) => lensFix(slug, "sony", [slug.toUpperCase()], {}, { focalMinMm: 24, focalMaxMm: 105, apertureMax: w, apertureMaxTele: t });
  const win = (x: ReturnType<typeof ap>, y: ReturnType<typeof ap>) => LENS_SPEC_GROUPS.flatMap((g) => compareRows([x, y], g)).find((r) => r.def.key === "aperture")!.cells.map((c) => c.win);
  assert.deepEqual(win(ap("v", 3.5, 5.6), ap("k", 4, null)), [false, false]);
  assert.deepEqual(win(ap("v", 2.8, 4), ap("k", 2.8, null)), [false, true]);
  assert.deepEqual(win(ap("v", 4, null), ap("k", 4.5, 5.6)), [true, false]);
});

test("unknown or unlike values are never ranked", () => {
  // IBIS without a stops rating is not "fewer stops" than a rated one.
  const unrated = cam("fx3", "sony", ["FX3"], {}, { ibis: true, ibisStops: null });
  assert.deepEqual(row("ibis", [unrated, a]).cells.map((c) => c.win), [false, false]);
  assert.deepEqual(keyDifferences(unrated, a, SPEC_GROUPS).filter((d) => d.startsWith("In-body")), []);
  // A "—" cell never wins.
  const noMin = cam("d", "sony", ["Delta"], {}, { isoMin: null, isoMax: 102400 });
  assert.deepEqual(row("isoRange", [noMin, a]).cells.map((c) => c.win), [false, false]);
  // Makers count subjects differently: only having subject detection ranks.
  const many = cam("e", "sony", ["Echo"], {}, { afSubjects: ["human", "animal", "bird", "insect", "vehicle", "train", "aircraft"] });
  const few = cam("f", "canon", ["Foxtrot"], {}, { afSubjects: ["human", "animal", "vehicle"] });
  const none = cam("g", "canon", ["Golf"], {}, { afSubjects: [] });
  assert.deepEqual(row("afSubjects", [many, few]).cells.map((c) => c.win), [false, false]);
  assert.deepEqual(row("afSubjects", [few, none]).cells.map((c) => c.win), [true, false]);
  // An optical finder is not "1M dots".
  const ovf = cam("h", "nikon", ["Hotel"], {}, { viewfinderType: "optical", evfDotsM: null });
  const evf = cam("i", "sony", ["India"], {}, { evfDotsM: 0.64 });
  const noVf = cam("j", "sony", ["Juliet"], {}, { viewfinderType: "none", evfDotsM: null });
  assert.deepEqual(row("viewfinder", [ovf, evf]).cells.map((c) => c.win), [false, false]);
  assert.deepEqual(row("viewfinder", [evf, noVf]).cells.map((c) => c.win), [true, false]);
});

import { dealSignal, priceDrops } from "../src/lib/insights";

test("price drops are this week's, on products still priced", () => {
  const h = new Map([
    ["stale", [{ day: "2026-09-01", new: 100000 }, { day: "2026-09-10", new: 80000 }]],
    ["short", [{ day: "2026-10-15", new: 100000 }, { day: "2026-10-16", new: 90000 }]],
    ["gap", [{ day: "2026-08-16", new: 100000 }, { day: "2026-10-16", new: 90000 }]],
    ["fresh", [{ day: "2026-10-09", new: 100000 }, { day: "2026-10-16", new: 95000 }]],
  ]);
  assert.deepEqual(priceDrops(h, "new").map((d) => [d.slug, d.pct]), [["fresh", 5]]);
});

test("a flat price is not the lowest we've seen", () => {
  const days = (n: number, v: number) => Array.from({ length: n }, (_, i) => ({ day: `2026-09-${String(i + 1).padStart(2, "0")}`, new: v }));
  // Today's own point (the import day) is in the history and is the same price.
  assert.equal(dealSignal(days(20, 200000), 200000, "new", "2026-09-20"), null);
  assert.deepEqual(dealSignal([...days(19, 200000), { day: "2026-09-20", new: 190000 }], 190000, "new", "2026-09-20"), { kind: "low-90", text: "Lowest new price we've seen in 20 days" });
  assert.equal(dealSignal(days(20, 200000), 200000), null);
});
