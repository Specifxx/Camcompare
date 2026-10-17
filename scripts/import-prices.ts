// Daily: `npm run import:prices` (refresh-prices.yml). Unconfigured sources
// are reported as skipped; the run still writes a valid file.
import { readCameraFiles } from "../src/lib/catalog/load";
import { runImport } from "../src/lib/import";
import { SOURCES } from "../src/lib/sources";

const { cameras, issues } = readCameraFiles();
if (issues.length) {
  console.error(`catalog has ${issues.length} issue(s); run npm run catalog:check`);
  process.exit(1);
}
const only = process.env.IMPORT_ONLY?.split(",").filter(Boolean);
runImport(cameras, only ? SOURCES.filter((s) => only.includes(s.retailer)) : SOURCES).catch((e) => {
  console.error(e);
  process.exit(1);
});
