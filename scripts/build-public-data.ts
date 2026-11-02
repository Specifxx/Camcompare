// Writes the static JSON the browser fetches (gitignored, rebuilt every build):
//   public/search-index.json   one row per published product, for the search box
//   public/prices/<market>.json lowest new/used per product, for compare pages
//                               and the saved list to show the visitor's market
//   public/offers/<market>/<slug>.json one product's quick view: its offer rows
//                               with affiliate links wrapped here, eBay listings,
//                               "Also check" links and key specs. Never an
//                               Amazon price (its licence: 24 hours), only a link.
import fs from "node:fs";
import path from "node:path";
import { brandName, offersFor, product, publishedCameras, publishedLenses } from "../src/lib/catalog";
import { quickViewData } from "../src/lib/offer-rows";
import { MARKET_CODES, MARKETS } from "../src/lib/markets";
import { lowest } from "../src/lib/offers";
import { retailer } from "../src/lib/retailers";
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
  // The store with the cheapest new price, for the saved list and a shared one (2026-11-02): [new store, used store].
  const s: Record<string, [string | null, string | null]> = {};
  for (const { p: x } of products) {
    const o = offersFor(x.slug, m);
    const ln = lowest(o, "new");
    const lu = lowest(o, "used");
    const n = ln?.price ?? null;
    const u = lu?.price ?? null;
    if (n !== null || u !== null) {
      p[x.slug] = [n, u];
      s[x.slug] = [ln ? (retailer(ln.retailer)?.name ?? ln.retailer) : null, lu ? (retailer(lu.retailer)?.name ?? lu.retailer) : null];
    }
  }
  fs.writeFileSync(path.join(pub, "prices", `${m}.json`), JSON.stringify({ currency: MARKETS[m].currency, p, s }));
}
const qvDir = path.join(pub, "offers");
fs.rmSync(qvDir, { recursive: true, force: true });
let qv = 0;
for (const m of MARKET_CODES) {
  fs.mkdirSync(path.join(qvDir, m), { recursive: true });
  for (const { p: x } of products) {
    const data = quickViewData(product(x.slug)!, m);
    if (data.rows.some((r) => r.amazon) || /amazon/i.test(JSON.stringify(data.rows))) throw new Error(`Amazon price in the quick view of ${x.slug}`);
    fs.writeFileSync(path.join(qvDir, m, `${x.slug}.json`), JSON.stringify(data));
    qv++;
  }
}
console.log(`quick view: ${qv} files`);
console.log(`search index: ${rows.length} products; prices for ${MARKET_CODES.length} markets`);
