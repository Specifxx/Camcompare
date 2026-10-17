"use client";
// Member reviews of one product: 1 to 5 stars and text, one per member
// (posting again replaces yours), votes on the left, sort by top/new.
import { useCallback, useEffect, useState } from "react";
import { REVIEW_MAX, REVIEW_MIN, SORTS, type ReviewItem, type ReviewSummary, type Sort, type VoteValue } from "@/lib/community/rules";
import { AuthorLine, PlainText, ReportLink, SignInBox, SortTabs, VoteArrows } from "./bits";
import { api, inputClass, linkButton, myVotes, useMe } from "./client";

type List = { items: ReviewItem[]; hasMore: boolean; summary: ReviewSummary };

export const stars = (n: number) => "★★★★★".slice(0, Math.round(n)) + "☆☆☆☆☆".slice(0, 5 - Math.round(n));

function ReviewForm({ slug, onSaved }: { slug: string; onSaved: () => void }) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [existing, setExisting] = useState<{ id: string; hidden: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<{ review: { id: string; rating: number; body: string; hidden: boolean } | null }>(`/api/community/reviews/mine?product=${slug}`).then((r) => {
      if (r.ok && r.review) {
        setExisting({ id: r.review.id, hidden: r.review.hidden });
        setRating(r.review.rating);
        setBody(r.review.body);
      }
    });
  }, [slug]);

  if (!open)
    return (
      <p className="text-sm">
        <button type="button" className="font-semibold text-accent hover:underline" onClick={() => setOpen(true)}>
          {existing ? "Edit your review" : "Write a review"}
        </button>
        {msg && <span className="ml-2 text-xs text-muted">{msg}</span>}
      </p>
    );
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!rating) return setMsg("Pick 1 to 5 stars.");
        setBusy(true);
        const r = await api<{ id: string }>("/api/community/reviews", { method: "POST", body: { product: slug, rating, body } });
        setBusy(false);
        if (!r.ok) return setMsg(r.error);
        setExisting({ id: r.id, hidden: false });
        setOpen(false);
        setMsg("Saved. It can take a minute to appear for everyone.");
        onSaved();
      }}
    >
      <fieldset className="flex items-center gap-1 text-sm">
        <legend className="sr-only">Your rating</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${n} star${n > 1 ? "s" : ""}`} aria-pressed={rating === n} onClick={() => setRating(n)} className={`text-lg leading-none ${n <= rating ? "text-accent" : "text-subtle"}`}>
            {n <= rating ? "★" : "☆"}
          </button>
        ))}
        <span className="ml-2 text-xs text-muted">{rating ? `${rating}/5` : "Your rating"}</span>
      </fieldset>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={REVIEW_MAX} rows={5} className={inputClass} placeholder={`What's it like to own and use? At least ${REVIEW_MIN} characters.`} />
      {existing?.hidden && <p className="text-xs text-warn">Your review is hidden after reports. Editing it doesn&apos;t unhide it.</p>}
      {msg && <p role="alert" className="text-xs text-warn">{msg}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn-primary px-3 py-1 text-xs disabled:opacity-60">
          {busy ? "Saving…" : existing ? "Update review" : "Post review"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={linkButton}>
          cancel
        </button>
        {existing && (
          <button
            type="button"
            className={linkButton}
            onClick={async () => {
              if (!confirm("Delete your review?")) return;
              const r = await api(`/api/community/reviews/${existing.id}`, { method: "DELETE" });
              if (r.ok) {
                setExisting(null);
                setRating(0);
                setBody("");
                setOpen(false);
                onSaved();
              }
            }}
          >
            delete
          </button>
        )}
      </div>
    </form>
  );
}

export function ReviewSummaryLine({ summary }: { summary: ReviewSummary | null }) {
  if (!summary || !summary.count || summary.average === null) return <span className="text-xs text-muted">No reviews yet</span>;
  return (
    <span className="text-xs text-muted">
      <span className="text-accent" aria-hidden>
        {stars(summary.average)}
      </span>{" "}
      {summary.average.toFixed(1)} out of 5 · {summary.count} review{summary.count === 1 ? "" : "s"}
    </span>
  );
}

export default function Reviews({ slug, onSummary }: { slug: string; onSummary?: (s: ReviewSummary) => void }) {
  const { user } = useMe();
  const [sort, setSort] = useState<Sort>("top");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<List | null>(null);
  const [err, setErr] = useState("");
  const [votes, setVotes] = useState<Record<string, VoteValue>>({});
  const [askSignIn, setAskSignIn] = useState(false);

  const load = useCallback(
    async (s: Sort, p: number) => {
      const r = await api<List>(`/api/community/reviews?product=${slug}&sort=${s}&page=${p}`);
      if (!r.ok) return setErr(r.status === 503 ? "Reviews aren't switched on yet." : r.error);
      setErr("");
      setList((prev) => (p > 1 && prev ? { ...r, items: [...prev.items, ...r.items] } : r));
      onSummary?.(r.summary);
    },
    [slug, onSummary],
  );
  useEffect(() => {
    void load(sort, page);
  }, [load, sort, page]);

  const idKey = (list?.items ?? []).map((r) => r.id).join(",");
  useEffect(() => {
    if (!user || !idKey) return;
    void myVotes("review", idKey.split(",")).then((v) => setVotes((o) => ({ ...o, ...v })));
  }, [user, idKey]);

  const h = list?.summary.histogram ?? [0, 0, 0, 0, 0];
  const total = list?.summary.count ?? 0;
  return (
    <div>
      {list && total > 0 && (
        <p className="mb-2 text-xs text-muted">
          {[5, 4, 3, 2, 1].map((s) => `${s}★ ${h[s - 1]}`).join(" · ")}
        </p>
      )}
      <div className="mb-2">{user?.username ? <ReviewForm slug={slug} onSaved={() => void load(sort, 1)} /> : <SignInBox prompt={askSignIn ? "You need to sign in for that." : "Sign in to write a review."} />}</div>
      <div className="flex items-center justify-between border-b border-line pb-1">
        <ReviewSummaryLine summary={list?.summary ?? null} />
        <SortTabs
          value={sort}
          options={SORTS}
          onChange={(s) => {
            setSort(s);
            setPage(1);
            setList(null);
          }}
        />
      </div>
      {err && <p className="py-3 text-sm text-muted">{err}</p>}
      {list && !list.items.length && !err && <p className="py-3 text-sm text-muted">No reviews yet. Own one? Tell people what it&apos;s like.</p>}
      <ul>
        {list?.items.map((r) => {
          const mine = Boolean(user?.username && r.author.username === user.username);
          return (
            <li key={r.id} className="flex gap-2 border-t border-line py-3">
              <VoteArrows kind="review" target={r.id} score={r.score} mine={votes[r.id] ?? 0} disabled={mine} onNeedSignIn={() => setAskSignIn(true)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="text-accent" aria-label={`${r.rating} out of 5 stars`}>
                    {stars(r.rating)}
                  </span>
                </p>
                <AuthorLine author={r.author} createdAt={r.createdAt} editedAt={r.editedAt} />
                <PlainText text={r.body} className="mt-1" />
                {!mine && (
                  <div className="mt-1">
                    <ReportLink kind="review" id={r.id} onNeedSignIn={() => setAskSignIn(true)} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {list?.hasMore && (
        <button type="button" onClick={() => setPage(page + 1)} className={`${linkButton} mt-2`}>
          more reviews
        </button>
      )}
    </div>
  );
}
