import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { RETAILERS } from "../src/lib/retailers";

test("refresh-prices passes every feed retailer's FEED_URL secret", () => {
  const yml = fs.readFileSync(path.join(process.cwd(), ".github", "workflows", "refresh-prices.yml"), "utf8");
  const missing = RETAILERS.filter((r) => r.source === "feed")
    .map((r) => `FEED_URL_${r.key.toUpperCase().replace(/-/g, "_")}`)
    .filter((env) => !yml.includes(`${env}: \${{ secrets.${env} }}`));
  assert.deepEqual(missing, [], "run: npx tsx scripts/sync-workflow-feeds.ts");
});

test("retailer keys are unique and every market has retailers", async () => {
  const { MARKET_CODES } = await import("../src/lib/markets");
  const keys = RETAILERS.map((r) => r.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const m of MARKET_CODES) assert.ok(RETAILERS.some((r) => r.market === m), m);
});
