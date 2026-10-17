// Cross-checks the hand-entered catalog against Wikidata and reports
// disagreements for a human to settle against the maker's spec sheet:
// announcement date (> 45 days apart), weight (> 5% apart) and mount.
// Wikidata is a second opinion, not the truth — it is wrong sometimes too.
//
//   npm run wikidata:crosscheck            report only
//   WRITE=1 npm run wikidata:crosscheck    also record each camera's Wikidata id
//                                           and add any GTINs Wikidata knows
import fs from "node:fs";
import path from "node:path";
import { readCameraFiles } from "../src/lib/catalog/load";
import { fetchWikidataCameras, linkAll } from "../src/lib/wikidata";

const MOUNT_WORDS: Record<string, RegExp> = {
  "sony-e": /sony e/i,
  "canon-rf": /canon rf|rf mount/i,
  "canon-ef": /canon ef/i,
  "canon-ef-m": /ef-m/i,
  "nikon-z": /nikon z/i,
  "nikon-f": /nikon f/i,
  "fujifilm-x": /fujifilm x|x mount/i,
  "fujifilm-g": /fujifilm g|g mount/i,
  "l-mount": /l-mount|l mount|leica l/i,
  "micro-four-thirds": /micro four thirds/i,
  "pentax-k": /pentax k|^k-mount/i,
  "leica-m": /leica m/i,
  "hasselblad-xcd": /xcd/i,
};

async function main() {
  const { cameras } = readCameraFiles();
  const items = await fetchWikidataCameras();
  const unlinked: string[] = [];
  const problems: string[] = [];
  let gtinsAdded = 0;
  const links = linkAll(cameras, items);
  for (const c of cameras) {
    const w = links.get(c.slug);
    if (!w) {
      unlinked.push(c.slug);
      continue;
    }
    if (w.announced) {
      const days = Math.abs(Date.parse(w.announced) - Date.parse(c.announced)) / 86400_000;
      if (days > 45) problems.push(`${c.slug}: announced ${c.announced}, Wikidata ${w.announced} (${w.qid})`);
    }
    if (w.massG && c.specs.weightG && Math.abs(w.massG - c.specs.weightG) / c.specs.weightG > 0.05) {
      problems.push(`${c.slug}: weight ${c.specs.weightG} g, Wikidata ${w.massG} g (${w.qid}; may be body-only)`);
    }
    // P2935 "connector" also lists hot shoes and HDMI: only compare lens mounts.
    if (w.mount && /mount|bayonet/i.test(w.mount) && c.mount && MOUNT_WORDS[c.mount] && !MOUNT_WORDS[c.mount].test(w.mount)) {
      problems.push(`${c.slug}: mount ${c.mount}, Wikidata "${w.mount}" (${w.qid})`);
    }
    if (process.env.WRITE) {
      const file = path.join(process.cwd(), "data", "cameras", `${c.slug}.json`);
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      const gtins = [...new Set([...raw.gtins, ...w.gtins.filter((g) => /^\d{8,14}$/.test(g))])];
      gtinsAdded += gtins.length - raw.gtins.length;
      raw.gtins = gtins;
      raw.wikidata = w.qid;
      fs.writeFileSync(file, JSON.stringify(raw, null, 2) + "\n");
    }
  }
  console.log(`${cameras.length - unlinked.length}/${cameras.length} cameras linked to Wikidata${process.env.WRITE ? `, ${gtinsAdded} GTINs added` : ""}`);
  if (unlinked.length) console.log(`Not linked (${unlinked.length}): ${unlinked.join(", ")}`);
  console.log(problems.length ? `\n${problems.length} disagreement(s) to check against the maker's spec sheet:\n  ${problems.join("\n  ")}` : "\nNo disagreements.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
