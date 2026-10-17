// The saved list ("watchlist"): kept in this browser only (localStorage), so
// it needs no account and no database. Each entry remembers the price the
// visitor saw, so /saved can show what changed since.
import type { MarketCode } from "./markets";

export type SavedItem = { slug: string; kind: "c" | "l"; market: MarketCode; at: string; seen: number | null };
const KEY = "cc_saved_v1";

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
