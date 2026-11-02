import { test } from "node:test";
import assert from "node:assert/strict";
import { linkBadge } from "../src/lib/link-badges";

test("a link badge is one escaped link: no iframe, script or image", () => {
  const b = linkBadge("https://example.com/a?b=1&c=2", `<"x">`);
  assert.match(b, /^<a href="https:\/\/example\.com\/a\?b=1&amp;c=2"/);
  assert.doesNotMatch(b, /<iframe|<script|<img|<"x">/i);
});
