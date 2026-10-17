// Daily: `npm run import:prices` (refresh-prices.yml). Unconfigured sources
// are reported as skipped; the run still writes a valid file per market.
//   IMPORT_MARKETS=uk,au   only these markets
//   IMPORT_ONLY=ebay-gb    only these retailer keys
import { readCameraFiles, readLensFiles } from "../src/lib/catalog/load";
import { runImport } from "../src/lib/import";
import { isMarket, MARKET_CODES } from "../src/lib/markets";

const { cameras, issues } = readCameraFiles();
const { lenses, issues: lensIssues } = readLensFiles();
if (issues.length || lensIssues.length) {
  console.error(`catalog has ${issues.length + lensIssues.length} issue(s); run npm run catalog:check`);
  process.exit(1);
}
const markets = (process.env.IMPORT_MARKETS?.split(",").filter(isMarket) ?? []).length ? process.env.IMPORT_MARKETS!.split(",").filter(isMarket) : [...MARKET_CODES];
const only = process.env.IMPORT_ONLY?.split(",").filter(Boolean);
runImport(markets, cameras, lenses, only).catch((e) => {
  console.error(e);
  process.exit(1);
});
