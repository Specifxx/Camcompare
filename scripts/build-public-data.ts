// Writes the static JSON the browser fetches (gitignored, rebuilt every build):
//   public/search-index.json   one row per published product, for the search box
//   public/prices/<market>.json lowest new/used per product, for compare pages
//                               and the saved list to show the visitor's market
import fs from "node:fs";
import path from "node:path";
import { brandName, offersFor, publishedCameras, publishedLenses } from "../src/lib/catalog";
import { MARKET_CODES, MARKETS } from "../src/lib/markets";
import { lowest } from "../src/lib/offers";
import type { SearchRow } from "../src/lib/search";

const pub = path.join(process.cwd(), "public");
const products = [...publishedCameras().map((p) => ({ k: "c" as const, p })), ...publishedLenses().map((p) => ({ k: "l" as const, p }))];

const rows: SearchRow[] = products.map(({ k, p }) => ({
  s: p.slug,
  k,
  n: p.name,
  a: [...new Set([...p.aliases, ...Object.values(p.regionalNames ?? {}), brandName(p.brand)])].join(" "),
  y: p.announced.slice(0, 4),
}));
fs.writeFileSync(path.join(pub, "search-index.json"), JSON.stringify(rows));

fs.mkdirSync(path.join(pub, "prices"), { recursive: true });
for (const m of MARKET_CODES) {
  const p: Record<string, [number | null, number | null]> = {};
  for (const { p: x } of products) {
    const o = offersFor(x.slug, m);
    const n = lowest(o, "new")?.price ?? null;
    const u = lowest(o, "used")?.price ?? null;
    if (n !== null || u !== null) p[x.slug] = [n, u];
  }
  fs.writeFileSync(path.join(pub, "prices", `${m}.json`), JSON.stringify({ currency: MARKETS[m].currency, p }));
}
console.log(`search index: ${rows.length} products; prices for ${MARKET_CODES.length} markets`);
