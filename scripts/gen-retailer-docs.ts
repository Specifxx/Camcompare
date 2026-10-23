// Regenerates the retailer tables in docs/retailers.md from the registry, so
// the doc can't drift from src/lib/retailers.ts.
//   npx tsx scripts/gen-retailer-docs.ts
import fs from "node:fs";
import path from "node:path";
import { MARKET_CODES, MARKETS } from "../src/lib/markets";
import { RETAILERS, type Retailer } from "../src/lib/retailers";

const NETWORK: Record<string, string> = {
  amazon: "Amazon Associates",
  epn: "eBay Partner Network",
  impact: "Impact",
  cj: "CJ",
  awin: "Awin",
  rakuten: "Rakuten Advertising",
  partnerize: "Partnerize",
  webgains: "Webgains",
  "commission-factory": "Commission Factory",
  lazada: "Lazada Affiliate",
  shopee: "Shopee Affiliate",
  direct: "Retailer's own programme",
};
const envKey = (r: Retailer) => r.key.toUpperCase().replace(/-/g, "_");

function prices(r: Retailer): string {
  switch (r.source) {
    case "amazon-creators":
      return "Creators API (after the account's first sales)";
    case "ebay-browse":
      return "Browse API (`EBAY_CLIENT_ID/SECRET`)";
    case "bestbuy-api":
      return "Products API (`BESTBUY_API_KEY`)";
    case "shopify":
      return r.shopify?.sitemap ? "Shopify sitemaps and product .js (no setup)" : "Shopify products.json (no setup)";
    case "structured":
      return "Structured data on its product pages (no setup)";
    case "feed":
      return `Product feed \`FEED_URL_${envKey(r)}\`${r.structured ? "; until then its pages' structured data" : r.shopify ? "; until then its Shopify sitemaps and product .js" : r.disabled ? ` only (own pages refused: ${r.disabled})` : ""}`;
    default:
      return "Link only";
  }
}
function link(r: Retailer): string {
  if (r.amazon) return `\`${r.amazon.tagEnv}\``;
  if (r.ebay) return "EPN campaign 5339155912 (in the code)";
  if (!r.network) return "—";
  return `\`AFFILIATE_DEEPLINK_${envKey(r)}\``;
}

const tables = MARKET_CODES.map((m) => {
  const rows = RETAILERS.filter((r) => r.market === m).map(
    (r) => `| ${r.name}${r.checkRow ? " ★" : ""} | ${r.country} | ${prices(r)} | ${r.network ? NETWORK[r.network] ?? r.network : "none known"} | ${link(r)} |`,
  );
  return `### ${MARKETS[m].flag} ${MARKETS[m].name} (${MARKETS[m].currency})\n\n| Retailer | Ships from | Prices from | Affiliate programme | Link variable |\n|---|---|---|---|---|\n${rows.join("\n")}`;
}).join("\n\n");

const file = path.join(process.cwd(), "docs", "retailers.md");
const src = fs.readFileSync(file, "utf8");
fs.writeFileSync(file, src.replace(/<!-- RETAILERS-START -->[\s\S]*<!-- RETAILERS-END -->/, `<!-- RETAILERS-START -->\n${tables}\n<!-- RETAILERS-END -->`));
const envFile = path.join(process.cwd(), ".env.example");
const deeplinks = RETAILERS.filter((r) => r.network && !r.amazon && !r.ebay).map((r) => `AFFILIATE_DEEPLINK_${envKey(r)}=  # ${r.name} (${MARKETS[r.market].short}, ${NETWORK[r.network!] ?? r.network})`);
const feeds = RETAILERS.filter((r) => r.source === "feed").map((r) => `FEED_URL_${envKey(r)}=  # ${r.name} (${MARKETS[r.market].short})`);
fs.writeFileSync(
  envFile,
  fs
    .readFileSync(envFile, "utf8")
    .replace(/# DEEPLINKS-START[\s\S]*# DEEPLINKS-END/, `# DEEPLINKS-START\n${deeplinks.join("\n")}\n# DEEPLINKS-END`)
    .replace(/# FEEDS-START[\s\S]*# FEEDS-END/, `# FEEDS-START\n${feeds.join("\n")}\n# FEEDS-END`),
);
console.log("docs/retailers.md and .env.example updated");
