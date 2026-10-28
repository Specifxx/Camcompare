import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAMILY_SITES } from "../src/lib/site";

// The footer links the owner's other ten sites (DECISIONS.md "Compare Empire
// family links"): plain followed links, never sponsored, never this site.
test("footer: the Compare Empire family, plain followed links with descriptive anchors", () => {
  assert.equal(FAMILY_SITES.length, 10);
  for (const s of FAMILY_SITES) {
    assert.equal(new URL(s.url).protocol, "https:", s.name);
    assert.doesNotMatch(s.url, /camcompare/, "never this site itself");
    assert.match(s.anchor, /prices$/, s.name);
  }
  const footer = readFileSync("src/components/Footer.tsx", "utf8");
  assert.match(footer, /FAMILY_SITES\.map/);
  assert.match(footer, /<a href=\{s\.url\} target="_blank" rel="noopener"/);
  assert.doesNotMatch(footer.slice(footer.indexOf("FAMILY_SITES.map")), /sponsored|nofollow|affiliateUrl/);
});
