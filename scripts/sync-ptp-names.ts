// Photons to Photos charts (PDR, read noise) take camera names in the URL
// hash, in its own spelling ("Nikon Z 6II", "Sony ILCE-7M4"). This reads its
// camera list and maps each name to a catalog body through the matcher, so the
// Low light links open with the right models plotted.
//   npx tsx scripts/sync-ptp-names.ts      writes data/ptp-names.json
import fs from "node:fs";
import path from "node:path";
import { readCameraFiles, readLensFiles } from "../src/lib/catalog/load";
import { buildIndex, matchListing } from "../src/lib/matching";

async function main() {
  const html = await (await fetch("https://www.photonstophotos.net/Charts/PDR.htm", { headers: { "User-Agent": "CamCompareBot/0.1 (+https://www.camcompare.app)" } })).text();
  // Variants like "(APS-C)", "(ES)" or "(DX)" are crop or shutter modes of the same body.
  const names = [...new Set([...html.matchAll(/'([A-Z][A-Za-z-]+ [^'<>()]{1,40})'/g)].map((m) => m[1].trim()))];
  const index = buildIndex(readCameraFiles().cameras, readLensFiles().lenses);
  const out: Record<string, string> = {};
  for (const name of names) {
    const m = matchListing({ title: name }, index, "camera");
    if (!m.product) continue;
    const prev = out[m.product.slug];
    if (!prev || name.length < prev.length) out[m.product.slug] = name;
  }
  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(path.join(process.cwd(), "data", "ptp-names.json"), JSON.stringify(sorted, null, 1) + "\n");
  console.log(`${names.length} Photons to Photos names, ${Object.keys(sorted).length} matched to catalog bodies`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
