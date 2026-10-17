// Runs first in every build: today's Amazon prices for the ASINs the daily
// import has found, written to data/offers-amazon/<market>.json (git-ignored).
// Amazon's licence allows its prices to be kept for 24 hours, so they are
// fetched fresh by each build and never committed (DECISIONS.md, 2026-10-17).
// Without Creators API credentials it writes nothing. A failure never fails
// the build: the Amazon row falls back to "Check price".
//   npx tsx scripts/fetch-amazon-prices.ts
import fs from "node:fs";
import { readCameraFiles, readLensFiles } from "../src/lib/catalog/load";
import { MARKET_CODES } from "../src/lib/markets";
import { buildIndex } from "../src/lib/matching";
import { AMAZON_OFFERS_DIR, amazonOffersFile, type Offer } from "../src/lib/offers";
import { retailersFor } from "../src/lib/retailers";
import { amazonPrices } from "../src/lib/sources/amazon";

async function main() {
  fs.rmSync(AMAZON_OFFERS_DIR, { recursive: true, force: true });
  const { cameras } = readCameraFiles();
  const { lenses } = readLensFiles();
  const index = buildIndex(cameras, lenses);
  const now = new Date().toISOString();
  for (const m of MARKET_CODES) {
    const offers: Offer[] = [];
    for (const r of retailersFor(m).filter((x) => x.amazon)) {
      try {
        const res = await amazonPrices(r, m, cameras, lenses, index, now);
        offers.push(...res.offers);
        console.log(`[${m}] ${r.key}: ${res.note}`);
      } catch (e) {
        console.log(`[${m}] ${r.key}: failed (${(e as Error).message.slice(0, 200)})`);
      }
    }
    if (!offers.length) continue;
    fs.mkdirSync(AMAZON_OFFERS_DIR, { recursive: true });
    fs.writeFileSync(amazonOffersFile(m), JSON.stringify({ generatedAt: now, market: m, offers }) + "\n");
  }
}

main().catch((e) => console.log(`Amazon prices skipped: ${(e as Error).message}`));
