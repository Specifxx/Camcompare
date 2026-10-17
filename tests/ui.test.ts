import assert from "node:assert/strict";
import { test } from "node:test";
import { guideHtml } from "../src/lib/guides";
import { savedChange, type SavedItem } from "../src/lib/saved";
import { replaceQuery } from "../src/lib/search";

test("guides keep site-internal links only, and raw HTML renders as text", () => {
  assert.equal(guideHtml("[ok](/cameras)").trim(), '<p><a href="/cameras">ok</a></p>');
  assert.equal(guideHtml('[t](/lenses "All lenses")').trim(), '<p><a href="/lenses" title="All lenses">t</a></p>');
  for (const md of ['[c](https://evil.example "Read more")', "[b](//evil.example/x)", "[s](/\\evil.example)", '[d](javascript:alert(1) "x")', "<https://evil.example>", "see https://bare.example", "![p](https://x.example/y.jpg)"]) {
    const html = guideHtml(md);
    assert.ok(!/<a |<img /.test(html), `${md} -> ${html}`);
  }
  assert.ok(!/<a |<img /.test(guideHtml('<a href="https://x" rel="y">raw</a>')));
  assert.ok(!guideHtml("<img src=x onerror=alert(1)>").includes("<img"));
  assert.ok(guideHtml("![p](/products/a.webp)").includes('<img src="/products/a.webp"'));
});

test("the saved list measures a change like with like", () => {
  const item = (seen: number, cond?: "new" | "used"): SavedItem => ({ slug: "x", kind: "c", market: "us", at: "2026-10-01", seen, cond });
  // Saved new; the new offers went out of stock: show used, no "drop".
  assert.deepEqual(savedChange(item(199900, "new"), [null, 149900], "us"), { now: 149900, cond: "used", delta: null });
  // Saved used; a dearer new offer appeared: lead with used, measure used.
  assert.deepEqual(savedChange(item(149900, "used"), [199900, 139900], "us"), { now: 139900, cond: "used", delta: -10000 });
  assert.deepEqual(savedChange(item(149900, "used"), [199900, null], "us"), { now: 199900, cond: "new", delta: null });
  // An entry saved before the condition was kept is read as new.
  assert.deepEqual(savedChange(item(199900), [189900, 149900], "us"), { now: 189900, cond: "new", delta: -10000 });
  // Another market's saved price is never compared.
  assert.equal(savedChange(item(199900, "new"), [189900, null], "uk").delta, null);
  assert.deepEqual(savedChange(item(199900, "new"), undefined, "us"), { now: null, cond: null, delta: null });
});

test("filter state goes into the query string without a history entry", () => {
  const calls: string[] = [];
  const g = globalThis as Record<string, unknown>;
  const loc = { pathname: "/lenses", search: "?utm_source=x&mount=canon-rf", hash: "" };
  g.window = { location: loc, history: { replaceState: (_d: unknown, _t: string, url: string) => void calls.push(url) } };
  try {
    replaceQuery({ mount: "sony-e,sigma-l", budget: 800, sort: null, q: "" });
    assert.deepEqual(calls, ["/lenses?utm_source=x&mount=sony-e,sigma-l&budget=800"]);
    loc.search = "?utm_source=x&mount=sony-e,sigma-l&budget=800";
    replaceQuery({ mount: "sony-e,sigma-l", budget: 800, sort: null });
    assert.equal(calls.length, 1, "an unchanged query is not written again");
    replaceQuery({ utm_source: null, mount: "", budget: null });
    assert.equal(calls[1], "/lenses");
  } finally {
    delete g.window;
  }
});
