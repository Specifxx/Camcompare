// Fails (exit 1) on any catalog file that does not parse or does not agree
// with the rest of the catalog. Runs first in `npm run build`.
import { crossCheck, readBrands, readCameraFiles, readLensFiles, readMounts } from "../src/lib/catalog/load";

const { cameras, issues } = readCameraFiles();
const { lenses, issues: lensIssues } = readLensFiles();
let all = [...issues, ...lensIssues, ...crossCheck(cameras, readBrands(), readMounts(), lenses)];
// CHECK_ONLY=slug,slug… limits the report to those files (catalog authors
// working in parallel check their own batch).
const only = process.env.CHECK_ONLY?.split(",").filter(Boolean);
if (only) all = all.filter((i) => only.some((s) => i.file === `${s}.json` || i.file === `lenses/${s}.json`));
for (const i of all) console.error(`${i.file}: ${i.message}`);
console.log(`${cameras.length} cameras, ${lenses.length} lenses, ${all.length} issue(s)`);
if (all.length) process.exit(1);
