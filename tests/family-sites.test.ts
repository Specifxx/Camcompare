import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { footerSisters } from "../src/lib/family-network";

// The footer (owner, 2026-11-02: the old eleven-site list was "convoluted"): our own cluster (Compare
// Empire) by name, plus one "A Compare Empire site" link to the network page (DECISIONS.md "Sites that grow each other").
test("footer: the tech sister and the network page, plain followed links", () => {
  assert.deepEqual(footerSisters("cam").map((s) => s.id), ["empire"]);
  const footer = readFileSync("src/components/Footer.tsx", "utf8");
  assert.match(footer, /footerSisters\("cam"\)/);
  assert.match(footer, /NETWORK_PAGE/);
  assert.match(footer, /A Compare Empire site/);
  assert.doesNotMatch(footer.slice(footer.lastIndexOf("footerSisters"), footer.indexOf("</nav>", footer.lastIndexOf("footerSisters"))), /sponsored|nofollow|affiliateUrl/);
});
