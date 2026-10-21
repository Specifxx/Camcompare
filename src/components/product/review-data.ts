"use client";
// One fetch of a product's most relevant member reviews per page, shared by
// the hero's star line and the Reviews section: the same URL the community
// Reviews component asks first (CDN-cached 30 s by /api/community/reviews).
import { api } from "@/components/community/client";
import type { ReviewItem, ReviewSummary } from "@/lib/community/rules";

export type TopReviews = { items: ReviewItem[]; summary: ReviewSummary; hasMore: boolean };

const cache = new Map<string, Promise<TopReviews | null>>();

export function loadTopReviews(slug: string): Promise<TopReviews | null> {
  let p = cache.get(slug);
  if (!p) {
    p = api<TopReviews>(`/api/community/reviews?product=${slug}&sort=top&page=1`).then((r) => (r.ok ? { items: r.items, summary: r.summary, hasMore: r.hasMore } : null));
    cache.set(slug, p);
  }
  return p;
}

export const starText = (n: number) => {
  const full = Math.floor(n + 0.25);
  const half = n - full >= 0.25 && n - full < 0.75 ? 1 : 0;
  return { full, half, empty: 5 - full - half };
};
