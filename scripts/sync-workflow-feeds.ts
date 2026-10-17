// Rewrites the FEED_URL_* block of refresh-prices.yml from the retailer
// registry, so adding a feed retailer can't forget its secret.
//   npx tsx scripts/sync-workflow-feeds.ts
import fs from "node:fs";
import path from "node:path";
import { RETAILERS } from "../src/lib/retailers";

const file = path.join(process.cwd(), ".github", "workflows", "refresh-prices.yml");
const src = fs.readFileSync(file, "utf8");
const lines = RETAILERS.filter((r) => r.source === "feed").map((r) => {
  const env = `FEED_URL_${r.key.toUpperCase().replace(/-/g, "_")}`;
  return `          ${env}: \${{ secrets.${env} }}`;
});
const out = src.replace(/( *# FEEDS-START\n)[\s\S]*?( *# FEEDS-END)/, `$1${lines.join("\n")}\n$2`);
fs.writeFileSync(file, out);
console.log(`${lines.length} feed secrets`);
