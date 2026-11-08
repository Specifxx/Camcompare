import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { footerSisters } from "../src/lib/family-network";

// The footer (owner, 2026-11-03: no sister list; 2026-11-08: no link to another of our domains on every page): one
// internal link to /our-sites, which lists every other family site once (DECISIONS.md).
test("footer: no sister list, one internal link to /our-sites", () => {
  assert.deepEqual(footerSisters("cam"), []);
  const footer = readFileSync("src/components/Footer.tsx", "utf8");
  assert.doesNotMatch(footer, /footerSisters|Sister site|NETWORK_PAGE/);
  assert.match(footer, /href="\/our-sites"/);
  const page = readFileSync("src/app/our-sites/page.tsx", "utf8");
  assert.match(page, /FAMILY_SITES\.filter\(\(s\) => s\.id !== "cam"\)/);
  assert.doesNotMatch(page, /sponsored|nofollow|affiliateUrl|revalidate/);
});
