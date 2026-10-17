// The saved list ("watchlist"): kept in this browser only (localStorage), so
// it needs no account and no database. Each entry remembers the price the
// visitor saw, so /saved can show what changed since.
import type { MarketCode } from "./markets";

// `cond` is the condition `seen` was priced in. An entry without one (saved
// before it was recorded) is read as new: the product pages lead with new.
export type SavedItem = { slug: string; kind: "c" | "l"; market: MarketCode; at: string; seen: number | null; cond?: "new" | "used" };
const KEY = "cc_saved_v1";

/**
 * Today's price for a saved item ([new, used] from /prices/<market>.json) and
 * the change since it was saved, like with like: the change is measured only
 * against today's price in the saved price's condition, so a new price that
 * went out of stock never reads as a drop to the used one. With no price in
 * that condition today, the other one is shown without a change.
 */
export function savedChange(it: SavedItem, today: [number | null, number | null] | undefined, market: MarketCode) {
  const [n, u] = today ?? [null, null];
  const cond = it.cond ?? "new";
  const same = cond === "new" ? n : u;
  const nowCond = same !== null ? cond : n !== null ? "new" : u !== null ? "used" : null;
  const now = nowCond === "new" ? n : nowCond === "used" ? u : null;
  const delta = it.market === market && it.seen !== null && same !== null ? same - it.seen : null;
  return { now, cond: nowCond, delta };
}

export function readSaved(): SavedItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? (v as SavedItem[]) : [];
  } catch {
    return [];
  }
}

export function writeSaved(items: SavedItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, 200)));
    window.dispatchEvent(new Event("cc-saved"));
  } catch {
    /* storage blocked: the list just isn't kept */
  }
}
