// Word of mouth (owner, 2026-11-02): shared links. Client-safe (no imports); the messages, which read the catalog,
// are in share-texts.ts. Every shared link carries utm_source=share&utm_medium=<what>; the button sends a Vercel
// "share" event, ShareArrival one "share_visit" when a shared link brings someone, and RiftCompare's weekly growth
// report counts both. DECISIONS.md, "Share buttons and shared saved lists".

export type ShareMedium = "product" | "list" | "page";

/** `path` (its own query string kept) on `origin`, with the share tags. */
export function shareUrl(origin: string, path: string, medium: ShareMedium): string {
  const u = new URL(path, origin);
  u.searchParams.set("utm_source", "share");
  u.searchParams.set("utm_medium", medium);
  return u.toString();
}

export interface GapRow {
  price: number;
  store: string;
}

/** One market's real spread: cheapest and dearest new, in-stock, body-only price from two stores; else null. */
export function priceGap(rows: readonly GapRow[]): { low: GapRow; high: GapRow; pct: number } | null {
  const live = rows.filter((r) => r.price > 0).slice().sort((a, b) => a.price - b.price);
  if (live.length < 2) return null;
  const low = live[0];
  const high = live[live.length - 1];
  if (new Set(live.map((r) => r.store)).size < 2 || high.price <= low.price) return null;
  return { low, high, pct: Math.round(((high.price - low.price) / high.price) * 100) };
}

// A shared saved list (/saved?i=c:<slug>.l:<slug>…): the items travel in the link, nothing is stored.
export const SHARED_PARAM = "i";
export function encodeSavedList(items: readonly { slug: string; kind: "c" | "l" }[]): string {
  return items.slice(0, 50).map((x) => `${x.kind}:${x.slug}`).join(".");
}
export function decodeSavedList(search: string): { slug: string; kind: "c" | "l" }[] | null {
  const v = new URLSearchParams(search).get(SHARED_PARAM);
  if (v == null) return null;
  const out = new Map<string, "c" | "l">();
  for (const part of v.split(".")) {
    const m = /^([cl]):([a-z0-9][a-z0-9-]{0,100})$/.exec(part.trim());
    if (m) out.set(m[2], m[1] as "c" | "l");
  }
  return [...out].slice(0, 50).map(([slug, kind]) => ({ slug, kind }));
}
