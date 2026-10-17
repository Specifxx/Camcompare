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
  const d = keyDifferences(a, b);
  assert.ok(d.includes("Alpha: resolution 33 MP, against 24.2 MP on the Bravo."), d.join("\n"));
});
