import { test } from "node:test";
import assert from "node:assert/strict";
import { comparePairs, isIndexedPair } from "../src/lib/catalog";
import type { Camera } from "../src/lib/catalog/schema";
import { SPEC_GROUPS } from "../src/lib/specs/definitions";
import { pairVerdict } from "../src/lib/pair-verdict";

test("every indexed camera pair gets a verdict built only from rows one side wins", () => {
  const pairs = comparePairs("camera").filter(([a, b]) => isIndexedPair(a, b));
  assert.ok(pairs.length > 50);
  for (const [a, b] of pairs) {
    const v = pairVerdict(a.item as Camera, b.item as Camera, SPEC_GROUPS);
    assert.ok(v.lines.length >= 1);
    for (const l of v.lines) assert.doesNotMatch(l, /undefined|null|NaN|\$/);
    assert.ok(!v.wins[0].some((w) => v.wins[1].includes(w)), `${a.item.slug}: a row cannot be won by both`);
  }
});
