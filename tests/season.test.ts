import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { isChristmas, SEASON_BOOT_SCRIPT } from "../src/lib/season";

// Christmas (owner, 2026-11-01): 1 November to Boxing Day by the visitor's own date; pure decoration.

const run = (d: Date, search = "") => {
  const attrs: Record<string, string> = {};
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor() {
      super(d.getTime());
    }
  }
  vm.runInNewContext(SEASON_BOOT_SCRIPT, { Date: FixedDate, location: { search }, document: { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } } });
  return attrs["data-season"] ?? null;
};

test("Christmas runs 1 November to Boxing Day every year", () => {
  assert.equal(isChristmas(new Date(2026, 9, 31, 23, 59)), false);
  assert.equal(isChristmas(new Date(2026, 10, 1, 0, 0)), true);
  assert.equal(isChristmas(new Date(2026, 11, 26, 23, 59)), true);
  assert.equal(isChristmas(new Date(2026, 11, 27, 0, 0)), false);
  assert.equal(isChristmas(new Date(2027, 10, 20)), true);
});

test("the boot script agrees with isChristmas(), takes ?season=, and never throws", () => {
  for (const d of [new Date(2026, 9, 31), new Date(2026, 10, 1), new Date(2026, 11, 26), new Date(2026, 11, 27)]) assert.equal(run(d) === "christmas", isChristmas(d));
  assert.equal(run(new Date(2027, 2, 3), "?season=christmas"), "christmas");
  assert.equal(run(new Date(2026, 10, 20), "?season=off"), null);
  assert.doesNotThrow(() => vm.runInNewContext(SEASON_BOOT_SCRIPT, { Date }));
});

test("the layout stamps the season before paint, and the decoration is gated and takes no taps", () => {
  assert.match(readFileSync("src/app/layout.tsx", "utf8"), /__html: SEASON_BOOT_SCRIPT/);
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.match(css, /\.xmas-only \{\s*display: none !important;/);
  for (const sel of [".xmas-snow {", ".xmas-lights {", ".xmas-art {", ".xmas-hero {"]) {
    const i = css.indexOf(sel);
    assert.ok(i >= 0, sel);
    assert.match(css.slice(i, css.indexOf("}", i)), /pointer-events: none;/, `${sel} must not take taps`);
  }
  assert.match(readFileSync("src/components/ChristmasDecor.tsx", "utf8"), /className="xmas-only xmas-hero" aria-hidden="true"/);
});
