// Writes the price history file each product page's chart fetches
// (lib/history-chart.ts): public/history/<market>/<slug>.json, git-ignored,
// rebuilt every build after build-public-data.ts. Recorded history
// (data/price-history) and archived history (data/price-history-archive)
// merged, archived days labelled; today's lowest new and used with the store.
// Never an Amazon price: lowest() leaves Amazon out, as history does.
import fs from "node:fs";
import path from "node:path";
import { historyFor, offersFor, publishedCameras, publishedLenses } from "../src/lib/catalog";
import { encodeHistory } from "../src/lib/history-chart";
import { MARKET_CODES, MARKETS } from "../src/lib/markets";
import { isAmazonOffer, lowest, mergeArchivedHistory, readArchivedHistory } from "../src/lib/offers";
import { retailer } from "../src/lib/retailers";

export function buildHistoryFiles(root = path.join(process.cwd(), "public", "history")) {
  fs.rmSync(root, { recursive: true, force: true });
  const today = new Date().toISOString().slice(0, 10);
  const name = (k: string) => retailer(k)?.name ?? k;
  let files = 0;
  let archivedProducts = 0;
  let bytes = 0;
  for (const m of MARKET_CODES) {
    fs.mkdirSync(path.join(root, m), { recursive: true });
    for (const p of [...publishedCameras(), ...publishedLenses()]) {
      const archived = readArchivedHistory(m, p.slug);
      const days = mergeArchivedHistory(historyFor(p.slug, m), archived);
      const offers = offersFor(p.slug, m);
      const n = lowest(offers, "new");
      const u = lowest(offers, "used");
      if (!days.length && !n && !u) continue;
      if ((n && isAmazonOffer(n)) || (u && isAmazonOffer(u))) throw new Error(`Amazon price in the history file of ${p.slug}`);
      const json = JSON.stringify(encodeHistory(MARKETS[m].currency, days, { day: today, new: n ? { price: n.price, store: n.retailer } : null, used: u ? { price: u.price, store: u.retailer } : null }, name));
      fs.writeFileSync(path.join(root, m, `${p.slug}.json`), json);
      files++;
      bytes += json.length;
      if (archived.length) archivedProducts++;
    }
  }
  console.log(`price history: ${files} files (${Math.round(bytes / 1024)} KB), ${archivedProducts} with archived points`);
}

buildHistoryFiles();
