"use client";
// The boards: a list of threads (one board or all) with votes, sort by
// top/new and paging, and the new-thread form for signed-in members.
import { useCallback, useEffect, useState } from "react";
import { BOARDS, boardName, SORTS, THREAD_BODY_MAX, THREAD_TITLE_MAX, threadPath, type BoardSlug, type Sort, type ThreadItem, type VoteValue } from "@/lib/community/rules";
import { AuthorLine, SignInBox, SortTabs, VoteArrows } from "./bits";
import { api, inputClass, linkButton, myVotes, useMe } from "./client";

function NewThread({ board, onCancel }: { board: BoardSlug | null; onCancel: () => void }) {
  const [b, setB] = useState<BoardSlug>(board ?? "general");
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
        const r = await api<{ id: string }>("/api/community/threads", { method: "POST", body: { board: b, title, body } });
        setBusy(false);
        if (!r.ok) return setErr(r.error);
        location.href = threadPath(r.id);
      }}
    >
      {!board && (
        <label className="block text-sm">
          <span className="font-semibold">Board</span>{" "}
          <select value={b} onChange={(e) => setB(e.target.value as BoardSlug)} className="ml-1 rounded border border-line bg-surface px-1 py-0.5 text-sm">
            {BOARDS.map((x) => (
              <option key={x.slug} value={x.slug}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={THREAD_TITLE_MAX} placeholder="Title" className={inputClass} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={THREAD_BODY_MAX} rows={6} placeholder="Text (optional). Plain text only, no images." className={inputClass} />
      {err && <p role="alert" className="text-xs text-warn">{err}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={busy || !title.trim()} className="btn-primary px-3 py-1 text-xs disabled:opacity-60">
          {busy ? "Posting…" : "Post thread"}
        </button>
        <button type="button" onClick={onCancel} className={linkButton}>
          cancel
        </button>
      </div>
    </form>
  );
}

export default function Threads({ board }: { board: BoardSlug | null }) {
  const { user } = useMe();
  const [sort, setSort] = useState<Sort>("new");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ThreadItem[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [err, setErr] = useState("");
  const [votes, setVotes] = useState<Record<string, VoteValue>>({});
  const [composing, setComposing] = useState(false);
  const [askSignIn, setAskSignIn] = useState(false);

  const load = useCallback(
    async (s: Sort, p: number) => {
      const r = await api<{ items: ThreadItem[]; hasMore: boolean }>(`/api/community/threads?sort=${s}&page=${p}${board ? `&board=${board}` : ""}`);
      if (!r.ok) return setErr(r.status === 503 ? "The boards aren't switched on yet. Please check back soon." : r.error);
      setErr("");
      setItems((prev) => (p > 1 && prev ? [...prev, ...r.items] : r.items));
      setHasMore(r.hasMore);
    },
    [board],
  );
  useEffect(() => {
    void load(sort, page);
  }, [load, sort, page]);

  const idKey = (items ?? []).map((t) => t.id).join(",");
  useEffect(() => {
    if (!user || !idKey) return;
    void myVotes("thread", idKey.split(",")).then((v) => setVotes((o) => ({ ...o, ...v })));
  }, [user, idKey]);

  return (
    <div>
      <div className="mb-2">
        {user?.username ? (
          composing ? (
            <NewThread board={board} onCancel={() => setComposing(false)} />
          ) : (
            <button type="button" onClick={() => setComposing(true)} className="text-sm font-semibold text-accent hover:underline">
              + New thread
            </button>
          )
        ) : (
          <SignInBox prompt={askSignIn ? "You need to sign in for that." : "Sign in to start a thread, reply and vote."} />
        )}
      </div>
      <div className="flex justify-end border-b border-line pb-1">
        <SortTabs
          value={sort}
          options={SORTS}
          onChange={(s) => {
            setSort(s);
            setPage(1);
            setItems(null);
          }}
        />
      </div>
      {err && <p className="py-3 text-sm text-muted">{err}</p>}
      {!items && !err && <p className="py-3 text-sm text-muted">Loading threads…</p>}
      {items && !items.length && !err && <p className="py-3 text-sm text-muted">No threads here yet. Start the first one.</p>}
      <ol>
        {items?.map((t) => (
          <li key={t.id} className="flex gap-2 border-b border-line py-2">
            <VoteArrows kind="thread" target={t.id} score={t.score} mine={votes[t.id] ?? 0} disabled={Boolean(user?.username && t.author?.username === user.username)} onNeedSignIn={() => setAskSignIn(true)} />
            <div className="min-w-0 flex-1">
              <a href={threadPath(t.id)} className="font-semibold text-fg">
                {t.title}
              </a>
              {!board && (
                <a href={`/community/${t.board}`} className="ml-2 text-xs text-muted">
                  {boardName(t.board)}
                </a>
              )}
              <AuthorLine
                author={t.author}
                createdAt={t.createdAt}
                extra={
                  <a href={threadPath(t.id)} className="ml-2 text-xs text-muted">
                    {t.replies} {t.replies === 1 ? "comment" : "comments"}
                  </a>
                }
              />
            </div>
          </li>
        ))}
      </ol>
      {hasMore && (
        <button type="button" onClick={() => setPage(page + 1)} className={`${linkButton} mt-2`}>
          more threads
        </button>
      )}
    </div>
  );
}
