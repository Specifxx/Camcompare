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

// ------------------------------------------------------------ URL state

/**
 * Mirrors a page's filter state into its query string without adding a
 * history entry, so Back from a product restores the list and the URL can be
 * shared. Empty values drop their key; other keys (?utm_…) stay. Data must be
 * null: Next's patched replaceState then copies its own history state and
 * keeps the router's URL in step. Client-only.
 */
export function replaceQuery(state: Record<string, string | number | null>) {
  const { pathname, search, hash } = window.location;
  const sp = new URLSearchParams(search);
  for (const [k, v] of Object.entries(state)) {
    if (v === null || v === "") sp.delete(k);
    else sp.set(k, String(v));
  }
  const qs = sp.toString().replace(/%2C/g, ",");
  if (`?${qs}` === search || (!qs && !search)) return;
  try {
    window.history.replaceState(null, "", `${pathname}${qs ? `?${qs}` : ""}${hash}`);
  } catch {
    /* Safari caps replaceState calls per second; the URL just lags */
  }
}
