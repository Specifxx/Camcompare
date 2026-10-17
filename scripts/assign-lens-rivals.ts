// Fills `rivals` for every lens from rules a buyer would recognise: same
// mount, same image circle, both autofocus (or both manual), both zooms or
// both primes, nearly the same focal range and zoom ratio, both constant- or
// both variable-aperture, and maximum apertures within 0.7 stop at each end.
// Up to three, closest first, favouring lenses still sold new.
// Deterministic, so re-running after adding lenses only changes what it must.
// Predecessors and successors are linked separately and are not rivals.
//
//   npx tsx scripts/assign-lens-rivals.ts          write
//   DRY=1 npx tsx scripts/assign-lens-rivals.ts    print only
import fs from "node:fs";
import path from "node:path";
import { readLensFiles } from "../src/lib/catalog/load";
import type { Lens } from "../src/lib/catalog/schema";

const MAX_RIVALS = 3;
const MAX_STOPS = 0.7;

const stops = (a: number, b: number) => Math.abs(2 * Math.log2(b / a));
const zoom = (l: Lens) => l.specs.focalMaxMm > l.specs.focalMinMm;
const ratio = (l: Lens) => l.specs.focalMaxMm / l.specs.focalMinMm;

/** How alike two focal ranges are: overlap over union (primes: within 15%). */
function focalMatch(a: Lens, b: Lens): number {
  if (!zoom(a)) return Math.abs(a.specs.focalMinMm - b.specs.focalMinMm) / a.specs.focalMinMm <= 0.15 ? 1 - Math.abs(a.specs.focalMinMm - b.specs.focalMinMm) / a.specs.focalMinMm : 0;
  const lo = Math.max(a.specs.focalMinMm, b.specs.focalMinMm);
  const hi = Math.min(a.specs.focalMaxMm, b.specs.focalMaxMm);
  const union = Math.max(a.specs.focalMaxMm, b.specs.focalMaxMm) - Math.min(a.specs.focalMinMm, b.specs.focalMinMm);
  return hi > lo ? (hi - lo) / union : 0;
}

export function rivalsFor(l: Lens, all: Lens[]): string[] {
  const family = new Set([l.predecessor, l.successor].filter(Boolean));
  return all
    .filter((c) => c.slug !== l.slug && !family.has(c.slug))
    .filter((c) => c.coverage === l.coverage && c.mounts.some((m) => l.mounts.includes(m)))
    .filter((c) => c.specs.autofocus === l.specs.autofocus && zoom(c) === zoom(l))
    .filter((c) => (c.specs.apertureMaxTele === null) === (l.specs.apertureMaxTele === null))
    .filter((c) => !zoom(l) || Math.abs(Math.log(ratio(c) / ratio(l))) <= Math.log(1.5))
    .map((c) => ({ c, f: focalMatch(l, c), s: Math.max(stops(l.specs.apertureMax, c.specs.apertureMax), stops(l.specs.apertureMaxTele ?? l.specs.apertureMax, c.specs.apertureMaxTele ?? c.specs.apertureMax)) }))
    .filter((x) => x.f >= 0.6 && x.s <= MAX_STOPS)
    .map((x) => ({ ...x, score: (1 - x.f) * 2 + x.s + (x.c.status === "current" ? 0 : 0.5) }))
    .sort((a, b) => a.score - b.score || a.c.slug.localeCompare(b.c.slug))
    .slice(0, MAX_RIVALS)
    .map((x) => x.c.slug);
}

if (require.main === module) {
  const { lenses } = readLensFiles();
  let changed = 0;
  for (const l of lenses) {
    const rivals = rivalsFor(l, lenses);
    if (JSON.stringify(rivals) === JSON.stringify(l.rivals)) continue;
    changed++;
    if (process.env.DRY) {
      console.log(`${l.slug}: ${rivals.join(", ") || "(none)"}`);
      continue;
    }
    const file = path.join(process.cwd(), "data", "lenses", `${l.slug}.json`);
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    raw.rivals = rivals;
    fs.writeFileSync(file, JSON.stringify(raw, null, 2) + "\n");
  }
  console.log(`${changed} of ${lenses.length} lenses ${process.env.DRY ? "would change" : "updated"}`);
}
