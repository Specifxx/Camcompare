// Runs after the daily import. Exits 1 — so GitHub emails the owner about a
// failed workflow — when a configured price source broke or went silent.
// RiftCompare's lesson: "the owner is not watching", so the site has to say
// when it breaks. Not-configured sources are listed but are not failures.
import { readOffersFile } from "../src/lib/offers";

const file = readOffersFile();
let bad = 0;
for (const [retailer, run] of Object.entries(file.sources).sort()) {
  const broken = run.status === "error";
  if (broken) bad++;
  console.log(`${broken ? "FAIL" : run.status === "skipped" ? "skip" : " ok "}  ${retailer.padEnd(8)} ${run.offers} offers${run.note ? `  ${run.note}` : ""}`);
}
const age = file.generatedAt ? (Date.now() - Date.parse(file.generatedAt)) / 3600_000 : Infinity;
if (age > 30) {
  console.log(`FAIL  offers file is ${Number.isFinite(age) ? `${Math.round(age)}h` : "never"} old`);
  bad++;
}
console.log(`${file.offers.length} offers for ${new Set(file.offers.map((o) => o.camera)).size} cameras`);
process.exit(bad ? 1 : 0);
