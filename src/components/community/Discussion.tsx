"use client";
// <Discussion target="product:<slug>" />: comments and member reviews under a
// camera or lens page. Nothing loads until the reader scrolls near it, so the
// static page stays static and most visits never touch the database.
import { useRef, useState } from "react";
import { parseTarget, type ReviewSummary } from "@/lib/community/rules";
import Comments from "./Comments";
import Reviews, { ReviewSummaryLine } from "./Reviews";
import { useNearViewport } from "./client";

export default function Discussion({ target, name }: { target: string; /** The product's short name, for the heading. */ name?: string }) {
  const ref = useRef<HTMLElement>(null);
  const near = useNearViewport(ref);
  const t = parseTarget(target);
  const [tab, setTab] = useState<"comments" | "reviews">("comments");
  const [count, setCount] = useState<number | null>(null);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  if (!t) return null;
  const isProduct = t.kind === "product";

  const tabBtn = (k: "comments" | "reviews", label: string) => (
    <button type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`border-b-2 px-1 pb-1 text-sm ${tab === k ? "border-accent font-semibold text-fg" : "border-transparent text-muted hover:text-fg"}`}>
      {label}
    </button>
  );

  return (
    <section ref={ref} id="discussion" aria-labelledby="discussion-h">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-line">
        <h2 id="discussion-h" className="h-section">
          Discussion{name ? <span className="text-muted"> · {name}</span> : null}
        </h2>
        <div role="tablist" className="flex gap-4">
          {tabBtn("comments", count === null ? "Comments" : `Comments (${count})`)}
          {isProduct && tabBtn("reviews", summary?.count ? `Reviews (${summary.count})` : "Reviews")}
        </div>
      </div>
      {isProduct && summary && (
        <p className="mb-2">
          <ReviewSummaryLine summary={summary} />
        </p>
      )}
      {!near ? (
        <p className="text-sm text-muted">Loading the discussion…</p>
      ) : (
        <>
          <div hidden={tab !== "comments"}>
            <Comments target={target} onCount={setCount} />
          </div>
          {isProduct && <div hidden={tab !== "reviews"}><Reviews slug={(t as { slug: string }).slug} onSummary={setSummary} /></div>}
        </>
      )}
      <p className="mt-3 text-[11px] text-subtle">
        Comments and reviews are members&apos; own opinions, not CamCompare&apos;s. Votes never change the order of prices. <a href="/community">Community boards</a>
      </p>
    </section>
  );
}
