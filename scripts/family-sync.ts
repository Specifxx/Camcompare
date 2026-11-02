// The Compare Empire network's step in refresh-prices.yml (lib/family-network.ts, DECISIONS.md "Sites that
// grow each other", 2026-11-02), after the offers are merged, before the commit: writes our feed and copies
// Compare Empire's into data/family/. Never fails the job.
import fs from "node:fs";
import path from "node:path";
import { FAMILY_DIR, familyItems, familyLinks, familyProducts } from "../src/lib/family";
import { CLUSTER_FILE, FEED_FILE, buildFeed, clusterIds, fetchFamilyFeeds, type FamilyCluster } from "../src/lib/family-network";

async function main() {
  fs.mkdirSync(FAMILY_DIR, { recursive: true });
  const feed = buildFeed("cam", familyItems(), familyLinks(), new Date(), familyProducts());
  fs.writeFileSync(path.join(FAMILY_DIR, FEED_FILE), JSON.stringify(feed) + "\n");
  console.log(`[family] ${FEED_FILE}: ${feed.items.length} items, ${feed.products?.length ?? 0} product names`);
  const ids = clusterIds("cam");
  const feeds = await fetchFamilyFeeds(ids);
  console.log(`[family] read ${feeds.length}/${ids.length} sister feeds`);
  if (!feeds.length && fs.existsSync(path.join(FAMILY_DIR, CLUSTER_FILE))) return;
  const out: FamilyCluster = { v: 1, site: "cam", fetchedAt: new Date().toISOString(), feeds };
  fs.writeFileSync(path.join(FAMILY_DIR, CLUSTER_FILE), JSON.stringify(out) + "\n");
}

main().catch((e) => console.warn("[family] skipped:", e instanceof Error ? e.message : e));
