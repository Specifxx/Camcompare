// The site search: a compact row per product, ranked by how well the query's
// words match the product's names. Shared by the build script (which writes
// public/search-index.json) and the client box. Client-safe.
export type SearchRow = { s: string; k: "c" | "l"; n: string; a: string; y: string };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/α/g, "a").replace(/[^a-z0-9.]+/g, " ").trim();
const squash = (s: string) => norm(s).replace(/[ .]+/g, "");

/**
 * Every query word must appear in the product's names (as a word prefix, or
 * anywhere once the names are squashed, so "a7iv" finds "a7 IV" and "2470"
 * finds "24-70mm"). Ranked: name starts with the query, then shorter names,
 * then newer.
 */
export function searchRank(rows: SearchRow[], q: string): SearchRow[] {
  const words = norm(q).split(" ").filter(Boolean);
  if (!words.length) return [];
  const scored: { r: SearchRow; score: number }[] = [];
  for (const r of rows) {
    const hay = norm(`${r.n} ${r.a}`);
    const hayWords = hay.split(" ");
    const hayFlat = squash(`${r.n} ${r.a}`);
    let ok = true;
    let score = 0;
    for (const w of words) {
      if (hayWords.some((h) => h.startsWith(w))) score += 3;
      else if (hayFlat.includes(w.replace(/\./g, ""))) score += 1;
      else {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (norm(r.n).startsWith(words.join(" "))) score += 5;
    scored.push({ r, score: score * 100 - r.n.length + Number(r.y) / 100 });
  }
  return scored.sort((a, b) => b.score - a.score).map((x) => x.r);
}
