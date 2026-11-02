// "Which should you buy?" for a /compare/<a>-vs-<b> page: plain sentences built
// only from spec rows where both values are known and one is clearly better
// (compareRows), so it never states a guess. Search Console (25–31 Oct): the
// site's clicks come from long-tail "X vs Y" searches ("nikon z50ii vs canon
// r10"), so the pair pages carry their own answer, not only a table. No price
// here: the page's prices follow the visitor's market, and this text does not.
import { compareRows, type SpecGroup } from "@/lib/specs/definitions";

export interface PairVerdict {
  /** Each side's winning rows' labels, strongest group first. */
  wins: [string[], string[]];
  /** One paragraph per side, then a closing line. */
  lines: string[];
}

/** "Native ISO" → "native ISO": lower-cases words, never acronyms. */
const lower = (label: string) => label.split(" ").map((w) => (/^[A-Z][a-z]/.test(w) ? w.toLowerCase() : w)).join(" ");
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export function pairVerdict<T extends { shortName: string }>(a: T, b: T, groups: SpecGroup<T>[], skip: string[] = ["announced"]): PairVerdict {
  const wins: [string[], string[]] = [[], []];
  for (const g of groups)
    for (const row of compareRows([a, b], g)) {
      if (skip.includes(row.def.key)) continue;
      const [x, y] = row.cells;
      if (!x.text || !y.text || x.win === y.win) continue;
      wins[x.win ? 0 : 1].push(lower(row.def.label));
    }
  const lines: string[] = [];
  const side = (p: T, w: string[], other: T) =>
    w.length
      ? `Choose the ${p.shortName} for its ${list(w.slice(0, 4))}.${w.length > 4 ? ` It leads on ${w.length} specs in all.` : ""}`
      : `On published specs the ${p.shortName} leads the ${other.shortName} nowhere; buy it for its price, its handling or the lenses you already own.`;
  if (!wins[0].length && !wins[1].length) {
    lines.push(`The ${a.shortName} and the ${b.shortName} match on every spec both makers publish, so the choice comes down to price, handling and the system you already own.`);
    return { wins, lines };
  }
  lines.push(side(a, wins[0], b), side(b, wins[1], a));
  const [more, fewer] = wins[0].length >= wins[1].length ? [a, b] : [b, a];
  if (wins[0].length !== wins[1].length)
    lines.push(`On paper the ${more.shortName} wins more rows (${Math.max(wins[0].length, wins[1].length)} to ${Math.min(wins[0].length, wins[1].length)}); if the ${fewer.shortName}'s strengths are the ones you shoot with, and its price is lower where you buy, it can still be the better buy.`);
  return { wins, lines };
}
