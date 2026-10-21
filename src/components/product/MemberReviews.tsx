"use client";
// Our members' reviews of one product, in the shape of a shopping panel's
// "User reviews": the average and a 1-5 star histogram, "What people are
// saying" (counted from members' own words, three reviews or more), then the
// community Reviews component (write, vote, sort by top or newest). Nothing
// loads until the reader scrolls near it.
import { useCallback, useEffect, useRef, useState } from "react";
import Reviews from "@/components/community/Reviews";
import { useNearViewport } from "@/components/community/client";
import type { ReviewSummary } from "@/lib/community/rules";
import { reviewTopics, topicTone } from "@/lib/review-topics";
import { loadTopReviews, type TopReviews } from "./review-data";
import Stars from "./Stars";

export default function MemberReviews({ slug, kind, name }: { slug: string; kind: "camera" | "lens"; name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useNearViewport(ref, "400px");
  const [top, setTop] = useState<TopReviews | null>(null);
  const [failed, setFailed] = useState(false);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  useEffect(() => {
    if (!near) return;
    let live = true;
    void loadTopReviews(slug).then((r) => {
      if (!live) return;
      if (r) setTop(r);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [near, slug]);
  // A review posted here updates the box (the component reloads its list).
  const onSummary = useCallback((s: ReviewSummary) => setSummary(s), []);
  const s = summary ?? top?.summary ?? null;
  const topics = top && (s?.count ?? 0) >= 3 && top.items.length >= 3 ? reviewTopics(top.items, kind) : [];
  const max = s ? Math.max(1, ...s.histogram) : 1;

  return (
    <div ref={ref} className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <div className="card p-4">
          {s && s.count > 0 && s.average !== null ? (
            <>
              <p className="flex items-end gap-2">
                <span className="text-4xl font-extrabold leading-none tracking-tight">{s.average.toFixed(1)}</span>
                <span className="pb-0.5 text-sm text-subtle">out of 5</span>
              </p>
              <Stars value={s.average} className="mt-1 text-lg" />
              <p className="text-xs text-subtle">
                {s.count} member review{s.count === 1 ? "" : "s"}
              </p>
              <ul className="mt-3 flex flex-col gap-1" aria-label="Ratings">
                {[5, 4, 3, 2, 1].map((n) => {
                  const c = s.histogram[n - 1];
                  return (
                    <li key={n} className="flex items-center gap-2 text-xs">
                      <span className="w-6 text-muted">{n}★</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${(c / max) * 100}%` }} />
                      </span>
                      <span className="w-6 text-right tabular-nums text-subtle">{c}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <>
              <p className="font-semibold">{!near || (!top && !failed) ? "Loading reviews…" : "No member reviews yet"}</p>
              <p className="mt-1 text-sm text-muted">Own the {name}? Tell other buyers what it&apos;s like to use.</p>
            </>
          )}
        </div>
        {topics.length > 0 && (
          <div className="card p-4">
            <h3 className="text-sm font-bold">What people are saying</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {topics.map((t) => {
                const tone = topicTone(t);
                return (
                  <li key={t.key} className={`rounded-full border px-2 py-0.5 text-xs ${tone === "good" ? "border-win/40 bg-buy-soft text-fg" : tone === "bad" ? "border-warn/40 bg-warn/10 text-fg" : "border-line bg-raised text-muted"}`} title={`${t.mentions} reviews mention it: ${t.good} rated 4-5 stars, ${t.bad} rated 1-2`}>
                    <span aria-hidden className={tone === "good" ? "text-win" : tone === "bad" ? "text-warn" : "text-subtle"}>
                      {tone === "good" ? "+ " : tone === "bad" ? "− " : "± "}
                    </span>
                    {t.label} <span className="text-subtle">{t.mentions}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[11px] text-subtle">How often members&apos; reviews mention each topic: + mostly in 4–5★ reviews, − mostly in 1–2★. Counted from their words, not written by us.</p>
          </div>
        )}
      </div>
      <div className="min-w-0">{near ? <Reviews slug={slug} onSummary={onSummary} /> : <p className="text-sm text-muted">Loading reviews…</p>}</div>
    </div>
  );
}
