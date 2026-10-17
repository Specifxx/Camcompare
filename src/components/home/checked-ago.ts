// Client-safe (no fs): the home page's freshness line (Freshness.tsx).

/** "3 hours ago" style freshness from the offers file's generatedAt; null when unknown. */
export function checkedAgo(generatedAt: string | null, now: number): string | null {
  if (!generatedAt) return null;
  const t = Date.parse(generatedAt);
  if (Number.isNaN(t)) return null;
  const mins = Math.max(0, Math.round((now - t) / 60000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** Compact "3h ago" for the deal feed (DealFeed.tsx); null when the time is unknown. */
export function shortAgo(iso: string | null | undefined, now: number): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const mins = Math.max(0, Math.round((now - t) / 60000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
