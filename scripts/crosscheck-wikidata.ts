// Cross-checks the hand-entered catalog, bodies and lenses, against Wikidata
// and reports disagreements for a human to settle against the maker's spec
// sheet: announcement date (> 45 days apart), weight (> 5% apart) and mount.
// Wikidata is a second opinion, not the truth — it is wrong sometimes too.
//
//   npm run wikidata:crosscheck            report only
//   WRITE=1 npm run wikidata:crosscheck    also record each product's Wikidata id
//                                           and add any GTINs Wikidata knows
import fs from "node:fs";
import path from "node:path";
import { readCameraFiles, readLensFiles, validGtin } from "../src/lib/catalog/load";
import { normalizeGtin } from "../src/lib/matching";
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
  const { lenses } = readLensFiles();
  // A GTIN sends a feed row straight to one product (matching.ts), so WRITE
  // never adds one another product holds, or one whose check digit is wrong:
  // those are printed for a look.
  const gtinOwner = new Map([...cameras, ...lenses].flatMap((p) => p.gtins.map((g) => [normalizeGtin(g), p.slug] as const)));
  const skipped: string[] = [];
  const problems: string[] = [];
  const kinds = [
    { kind: "camera", dir: "cameras", list: cameras.map((p) => ({ p, mounts: p.mount ? [p.mount] : [], weightG: p.specs.weightG })) },
    { kind: "lens", dir: "lenses", list: lenses.map((p) => ({ p, mounts: p.mounts, weightG: p.specs.weightG })) },
  ] as const;
  for (const { kind, dir, list } of kinds) {
    const items = await fetchWikidataCameras(kind);
    const unlinked: string[] = [];
    let gtinsAdded = 0;
    const links = linkAll(list.map((x) => x.p), items);
    for (const { p, mounts, weightG } of list) {
      const w = links.get(p.slug);
      if (!w) {
        unlinked.push(p.slug);
        continue;
      }
      if (w.announced) {
        const days = Math.abs(Date.parse(w.announced) - Date.parse(p.announced)) / 86400_000;
        if (days > 45) problems.push(`${p.slug}: announced ${p.announced}, Wikidata ${w.announced} (${w.qid})`);
      }
      if (w.massG && weightG && Math.abs(w.massG - weightG) / weightG > 0.05) {
        problems.push(`${p.slug}: weight ${weightG} g, Wikidata ${w.massG} g (${w.qid}${kind === "camera" ? "; may be body-only" : ""})`);
      }
      // P2935 "connector" also lists hot shoes and HDMI: only compare lens mounts,
      // and a lens made in several mounts needs to match only one.
      const theirs = w.mounts.filter((m) => /mount|bayonet/i.test(m));
      const ours = mounts.filter((m) => MOUNT_WORDS[m]);
      if (theirs.length && ours.length && !ours.some((m) => theirs.some((t) => MOUNT_WORDS[m].test(t)))) {
        problems.push(`${p.slug}: mount ${mounts.join(", ")}, Wikidata "${theirs.join('", "')}" (${w.qid})`);
      }
      if (process.env.WRITE) {
        const file = path.join(process.cwd(), "data", dir, `${p.slug}.json`);
        const raw = JSON.parse(fs.readFileSync(file, "utf8"));
        for (const g of w.gtins) {
          const owner = gtinOwner.get(normalizeGtin(g));
          if (owner === p.slug) continue;
          if (owner || !validGtin(g)) {
            skipped.push(`${p.slug}: ${g} (${owner ? `belongs to ${owner}` : "not a valid GTIN"}, ${w.qid})`);
            continue;
          }
          raw.gtins.push(g);
          gtinOwner.set(normalizeGtin(g), p.slug);
          gtinsAdded++;
        }
        raw.wikidata = w.qid;
        fs.writeFileSync(file, JSON.stringify(raw, null, 2) + "\n");
      }
    }
    console.log(`${list.length - unlinked.length}/${list.length} ${kind === "camera" ? "cameras" : "lenses"} linked to Wikidata${process.env.WRITE ? `, ${gtinsAdded} GTINs added` : ""}`);
    if (unlinked.length) console.log(`Not linked (${unlinked.length}): ${unlinked.join(", ")}`);
  }
  if (skipped.length) console.log(`\n${skipped.length} Wikidata GTIN(s) not added, check by hand:\n  ${skipped.join("\n  ")}`);
  console.log(problems.length ? `\n${problems.length} disagreement(s) to check against the maker's spec sheet:\n  ${problems.join("\n  ")}` : "\nNo disagreements.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
