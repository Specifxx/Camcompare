"use client";
// The request board on /requests: members' feature and gear requests with
// votes, the owner's status (planned / done / won't do) and a note, sorted
// by votes or date, filtered by status, with comments under each on demand.
// Loads from the CDN-cached /api/community/requests after the page renders.
import { useCallback, useEffect, useState } from "react";
import { REQUEST_BODY_MAX, REQUEST_KINDS, REQUEST_STATUSES, REQUEST_TITLE_MAX, requestKindLabel, requestStatusLabel, type RequestItem, type RequestKind, type RequestStatus } from "@/lib/community/requests";
import { SORTS, type Sort, type VoteValue } from "@/lib/community/rules";
import { AuthorLine, PlainText, ReportLink, SignInBox, SortTabs, VoteArrows } from "./bits";
import { api, inputClass, linkButton, myVotes, useMe } from "./client";
import Comments from "./Comments";

const STATUS_STYLE: Record<RequestStatus, string> = { open: "text-muted", planned: "text-accent", done: "text-win", wont: "text-subtle line-through" };

function NewRequest({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [kind, setKind] = useState<RequestKind>("feature");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-2 border-b border-line pb-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await api<{ id: string }>("/api/community/requests", { method: "POST", body: { kind, title, body } });
        setBusy(false);
        if (!r.ok) return setErr(r.error);
        onDone();
      }}
    >
      <label className="block text-sm">
        <span className="font-semibold">What kind</span>{" "}
        <select value={kind} onChange={(e) => setKind(e.target.value as RequestKind)} className="ml-1 rounded border border-line bg-surface px-1 py-0.5 text-sm">
          {REQUEST_KINDS.map((k) => (
            <option key={k.slug} value={k.slug}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={REQUEST_TITLE_MAX} placeholder={kind === "store" ? "e.g. Track prices at Camera House" : kind === "gear" ? "e.g. Add the Kodak PIXPRO FZ55" : "e.g. Show the shutter count on used listings"} className={inputClass} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={REQUEST_BODY_MAX} rows={4} placeholder="Why it would help (optional). For a store, its web address." className={inputClass} />
      {err && <p role="alert" className="text-xs text-warn">{err}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={busy || title.trim().length < 8} className="btn-primary px-3 py-1 text-xs disabled:opacity-60">
          {busy ? "Posting…" : "Post request"}
        </button>
        <button type="button" onClick={onCancel} className={linkButton}>
          cancel
        </button>
      </div>
    </form>
  );
}

function Row({ r, mine, own, onNeedSignIn, onGone }: { r: RequestItem; mine: VoteValue; own: boolean; onNeedSignIn: () => void; onGone: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (location.hash === `#r${r.id}`) setOpen(true);
  }, [r.id]);
  return (
    <li id={`r${r.id}`} className="flex gap-2 border-b border-line py-2">
      <VoteArrows kind="request" target={r.id} score={r.score} mine={mine} disabled={own} onNeedSignIn={onNeedSignIn} />
      <div className="min-w-0 flex-1">
        <p className="text-xs">
          <span className={`font-semibold ${STATUS_STYLE[r.status]}`}>{requestStatusLabel(r.status)}</span>
          <span className="text-subtle"> · {requestKindLabel(r.kind)}</span>
        </p>
        <p className="font-semibold">{r.title}</p>
        {r.statusNote && <p className="text-sm text-accent">Owner: {r.statusNote}</p>}
        {r.body && <PlainText text={r.body} className="text-muted" />}
        <AuthorLine
          author={r.author}
          createdAt={r.createdAt}
          extra={
            <>
              <button type="button" onClick={() => setOpen(!open)} className={`${linkButton} ml-2`} aria-expanded={open}>
                {r.comments} {r.comments === 1 ? "comment" : "comments"}
              </button>
              <span className="ml-2">
                {own ? (
                  <button
                    type="button"
                    className={linkButton}
                    onClick={async () => {
                      if (!confirm("Withdraw this request?")) return;
                      const res = await api(`/api/community/requests/${r.id}`, { method: "DELETE" });
                      if (res.ok) onGone();
                    }}
                  >
                    withdraw
                  </button>
                ) : (
                  <ReportLink kind="request" id={r.id} onNeedSignIn={onNeedSignIn} />
                )}
              </span>
            </>
          }
        />
        {open && (
          <div className="mt-2">
            <Comments target={`request:${r.id}`} />
          </div>
        )}
      </div>
    </li>
  );
}

export default function Requests() {
  const { user } = useMe();
  const [sort, setSort] = useState<Sort>("top");
  const [status, setStatus] = useState<RequestStatus | null>(null);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<RequestItem[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [err, setErr] = useState("");
  const [votes, setVotes] = useState<Record<string, VoteValue>>({});
  const [composing, setComposing] = useState(false);
  const [askSignIn, setAskSignIn] = useState(false);
  const [posted, setPosted] = useState(false);

  const load = useCallback(async (s: Sort, st: RequestStatus | null, p: number) => {
    const r = await api<{ items: RequestItem[]; hasMore: boolean }>(`/api/community/requests?sort=${s}&page=${p}${st ? `&status=${st}` : ""}`);
    if (!r.ok) return setErr(r.status === 503 ? "The request board isn't switched on yet. Please check back soon." : r.error);
    setErr("");
    setItems((prev) => (p > 1 && prev ? [...prev, ...r.items] : r.items));
    setHasMore(r.hasMore);
  }, []);
  useEffect(() => {
    void load(sort, status, page);
  }, [load, sort, status, page]);

  const idKey = (items ?? []).map((r) => r.id).join(",");
  useEffect(() => {
    if (!user || !idKey) return;
    void myVotes("request", idKey.split(",")).then((v) => setVotes((o) => ({ ...o, ...v })));
  }, [user, idKey]);

  const reset = () => {
    setPage(1);
    setItems(null);
  };

  return (
    <div>
      <div className="mb-2">
        {posted && <p className="mb-2 text-sm text-win">Posted. It shows on the board within a minute.</p>}
        {user?.username ? (
          composing ? (
            <NewRequest
              onCancel={() => setComposing(false)}
              onDone={() => {
                setComposing(false);
                setPosted(true);
                setSort("new");
                reset();
              }}
            />
          ) : (
            <button type="button" onClick={() => setComposing(true)} className="text-sm font-semibold text-accent hover:underline">
              + New request
            </button>
          )
        ) : (
          <SignInBox prompt={askSignIn ? "You need to sign in for that." : "Sign in to post a request and vote."} />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-1">
        <div className="flex flex-wrap gap-x-3 text-xs" role="group" aria-label="Filter by status">
          {[null, ...REQUEST_STATUSES.map((s) => s.slug)].map((s) => (
            <button
              key={s ?? "all"}
              type="button"
              aria-pressed={status === s}
              onClick={() => {
                setStatus(s);
                reset();
              }}
              className={status === s ? "font-semibold text-fg" : "text-muted hover:text-fg hover:underline"}
            >
              {s ? requestStatusLabel(s) : "All"}
            </button>
          ))}
        </div>
        <SortTabs
          value={sort}
          options={SORTS}
          onChange={(s) => {
            setSort(s);
            reset();
          }}
        />
      </div>
      {err && <p className="py-3 text-sm text-muted">{err}</p>}
      {!items && !err && <p className="py-3 text-sm text-muted">Loading requests…</p>}
      {items && !items.length && !err && <p className="py-3 text-sm text-muted">No requests here yet.</p>}
      <ol>
        {items?.map((r) => (
          <Row
            key={r.id}
            r={r}
            mine={votes[r.id] ?? 0}
            own={Boolean(user?.username && r.author?.username === user.username)}
            onNeedSignIn={() => setAskSignIn(true)}
            onGone={() => setItems((xs) => (xs ?? []).filter((x) => x.id !== r.id))}
          />
        ))}
      </ol>
      {hasMore && (
        <button type="button" onClick={() => setPage(page + 1)} className={`${linkButton} mt-2`}>
          more requests
        </button>
      )}
    </div>
  );
}
