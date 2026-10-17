// Fails (exit 1) on any catalog file that does not parse or does not agree
// with the rest of the catalog. Runs first in `npm run build`.
import { crossCheck, readBrands, readCameraFiles, readMounts } from "../src/lib/catalog/load";

const { cameras, issues } = readCameraFiles();
const all = [...issues, ...crossCheck(cameras, readBrands(), readMounts())];
for (const i of all) console.error(`${i.file}: ${i.message}`);
console.log(`${cameras.length} cameras, ${all.length} issue(s)`);
if (all.length) process.exit(1);
