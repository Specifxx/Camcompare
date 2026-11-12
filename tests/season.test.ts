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

test("the layout stamps the season before paint, and Christmas is one quiet line (owner, 2026-11-08)", () => {
  assert.match(readFileSync("src/app/layout.tsx", "utf8"), /__html: SEASON_BOOT_SCRIPT/);
  const css = readFileSync("src/app/globals.css", "utf8");
  // "The theme must match the domain": no snow, lights, art or Santa hat; only the deals line, in the site's colours.
  for (const gone of [".xmas-snow", ".xmas-lights", ".xmas-art", ".xmas-hero", ".xmas-logo-hat", "/xmas/"]) assert.ok(!css.includes(gone), gone);
  assert.match(css, /:root\[data-season="christmas"\] \.xmas-pill-row \{\s*display: flex;/);
  assert.match(css, /\.xmas-pill \{[^}]*color: inherit;/);
});

test("the festive layer (owner, 2026-11-12) is CSS-only accents behind one switch, and the 8 November effects stay gone", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const season = readFileSync("src/lib/season.ts", "utf8");
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const banner = readFileSync("src/components/ChristmasBanner.tsx", "utf8");
  assert.match(season, /export const CHRISTMAS_FESTIVE_LAYER = true;/, "one off switch");
  assert.match(layout, /data-festive=\{CHRISTMAS_FESTIVE_LAYER/, "the layout stamps data-festive from the switch");
  assert.match(banner, /if \(!CHRISTMAS_FESTIVE_LAYER\)/, "the switch gates the banner markup");
  assert.doesNotMatch(banner, /<h[1-6]/, "the banner is not a heading");
  assert.match(banner, /currentColor/, "the gift icon is inline SVG in currentColor");
  assert.match(css, /\[data-festive\]::before \{[^}]*height: 3px;[^}]*rgb\(var\(--xmas-red\)\) 50%, rgb\(var\(--xmas-green\)\) 50%/, "a 3px two-tone hairline, hard stop");
  assert.match(css, /prefers-color-scheme: dark\) \{\s*:root\[data-season="christmas"\]\[data-festive\] \{[^}]*--xmas-red/, "dark mode has its own tokens");
  const block = css.slice(css.indexOf("/* xmas-common:start"), css.indexOf("/* xmas-common:end */")).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(block.includes(".xmas-gift"));
  assert.doesNotMatch(block, /@keyframes|animation:|repeating-linear-gradient|canvas|url\(|snow|flake/i, "no animation, stripes, canvas, images, snow or flakes");
  assert.doesNotMatch(block, /--c-(bg|surface|fg|accent|accent-2|buy)\s*:/, "no palette swap");
});
