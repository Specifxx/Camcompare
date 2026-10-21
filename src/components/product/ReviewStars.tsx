"use client";
// The hero's star line: our members' average, loaded after the page is idle
// (so it never delays the photo or the price) and hidden when there are no
// reviews or the community is off.
import { useEffect, useState } from "react";
import type { ReviewSummary } from "@/lib/community/rules";
import { loadTopReviews } from "./review-data";
import Stars from "./Stars";

export default function ReviewStars({ slug }: { slug: string }) {
  const [s, setS] = useState<ReviewSummary | null>(null);
  useEffect(() => {
    let live = true;
    const go = () => void loadTopReviews(slug).then((r) => live && r && setS(r.summary));
    const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(go, { timeout: 2500 });
    else setTimeout(go, 1200);
    return () => {
      live = false;
    };
  }, [slug]);
  if (!s || !s.count || s.average === null) return null;
  return (
    <a href="#reviews" className="inline-flex items-center gap-1.5 text-sm text-muted no-underline hover:text-fg">
      <span className="font-semibold text-fg">{s.average.toFixed(1)}</span>
      <Stars value={s.average} />
      <span className="underline decoration-line underline-offset-2">
        {s.count} member review{s.count === 1 ? "" : "s"}
      </span>
    </a>
  );
}
