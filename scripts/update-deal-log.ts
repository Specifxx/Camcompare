// After each price import (refresh-prices.yml): update data/deal-log/<m>.json,
// the home page's deal feed memory (src/lib/deal-log.ts): new deals, price
// drops, deals that sold or expired, and gone deals older than a week dropped.
// Usage: npx tsx scripts/update-deal-log.ts [markets, comma-separated]
import { dealInputs } from "../src/lib/deal-inputs";
import { readDealLog, updateDealLog, writeDealLog } from "../src/lib/deal-log";
import { MARKET_CODES, MARKETS, type MarketCode } from "../src/lib/markets";
import { readOffersFile } from "../src/lib/offers";

const arg = (process.argv[2] ?? process.env.IMPORT_MARKETS ?? "").trim();
const markets = (arg ? arg.split(",").map((s) => s.trim()) : MARKET_CODES).filter((m): m is MarketCode => (MARKET_CODES as readonly string[]).includes(m));

for (const m of markets) {
  const file = readOffersFile(m);
  if (!file.generatedAt) {
    console.log(`${m}: no offers yet, deal log left alone`);
    continue;
  }
  const prev = readDealLog(m);
  if (prev?.updatedAt && prev.updatedAt >= file.generatedAt) {
    console.log(`${m}: deal log already at ${prev.updatedAt}`);
    continue;
  }
  const next = updateDealLog(prev, dealInputs(m), { market: m, currency: MARKETS[m].currency, now: file.generatedAt });
  writeDealLog(next);
  const live = next.deals.filter((d) => d.status === "live").length;
  const goneNow = next.deals.filter((d) => d.goneAt === file.generatedAt).length;
  const fresh = next.deals.filter((d) => d.firstSeen === file.generatedAt && d.status === "live").length;
  console.log(`${m}: ${live} live (${fresh} new), ${goneNow} gone this run, ${next.deals.length} in the log`);
}
