import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { footerSisters } from "../src/lib/family-network";

// The footer (owner, 2026-11-03): no sister-site list, only one "A Compare Empire site" link to the
// network page that lists every site (DECISIONS.md).
test("footer: no sister list, one plain link to the network page", () => {
  assert.deepEqual(footerSisters("cam"), []);
  const footer = readFileSync("src/components/Footer.tsx", "utf8");
  assert.doesNotMatch(footer, /footerSisters|Sister site/);
  assert.match(footer, /NETWORK_PAGE/);
  assert.match(footer, /A Compare Empire site/);
  assert.doesNotMatch(footer.slice(footer.lastIndexOf("NETWORK_PAGE"), footer.indexOf("</nav>", footer.lastIndexOf("NETWORK_PAGE"))), /sponsored|nofollow|affiliateUrl/);
});
