"use client";
// Comments for one target ("product:<slug>", "deal:<key>", "thread:<id>"):
// votes on the left, one level of replies that collapse, sort by top/new,
// edit and delete your own, report anyone's. Loads from the CDN-cached
// GET /api/community/comments, so your own new comment is added locally
// (the cached list catches up within a minute).
import { useCallback, useEffect, useState } from "react";
import { COMMENT_MAX, SORTS, type CommentItem, type Sort, type VoteValue } from "@/lib/community/rules";
import { AuthorLine, PlainText, ReportLink, SignInBox, SortTabs, VoteArrows } from "./bits";
import { api, inputClass, linkButton, myVotes, useMe } from "./client";

type List = { items: CommentItem[]; hasMore: boolean; total: number };

function Composer({ target, parentId, initial = "", submitLabel, onDone, onCancel }: { target: string; parentId?: string; initial?: string; submitLabel: string; onDone: (c: CommentItem | string) => void; onCancel?: () => void }) {
  const [body, setBody] = useState(initial);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const editing = Boolean(initial);
  return (
    <form
      className="space-y-1"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim()) return;
        setBusy(true);
        const r = editing
          ? await api<{ body: string }>(`/api/community/comments/${parentId}`, { method: "PATCH", body: { body } })
          : await api<{ comment: CommentItem }>("/api/community/comments", { method: "POST", body: { target, body, parentId: parentId ?? null } });
        setBusy(false);
        if (!r.ok) return setErr(r.error);
        setErr("");
        setBody("");
        onDone("comment" in r ? r.comment : (r as { body: string }).body);
      }}
    >
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={COMMENT_MAX} rows={parentId && !editing ? 3 : 4} className={inputClass} placeholder={parentId && !editing ? "Write a reply" : "What do you think?"} />
      {err && <p role="alert" className="text-xs text-warn">{err}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || !body.trim()} className="btn-primary px-3 py-1 text-xs disabled:opacity-60">
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={linkButton}>
            cancel
          </button>
        )}
        <span className="text-[11px] text-subtle">Plain text. Links are shown but not followed by search engines.</span>
      </div>
    </form>
  );
}

function CommentRow({ c, target, votes, isReply, onChange, onNeedSignIn }: { c: CommentItem; target: string; votes: Record<string, VoteValue>; isReply?: boolean; onChange: (next: CommentItem | null) => void; onNeedSignIn: () => void }) {
  const { user } = useMe();
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const mine = Boolean(user?.username && c.author?.username === user.username);
  const replies = c.replies ?? [];

  return (
    <li className={isReply ? "mt-3" : "border-t border-line py-3"}>
      <div className="flex gap-2">
        {c.deleted ? <div className="w-8 shrink-0" /> : <VoteArrows kind="comment" target={c.id} score={c.score} mine={votes[c.id] ?? 0} disabled={mine} onNeedSignIn={onNeedSignIn} />}
        <div className="min-w-0 flex-1">
          <AuthorLine
            author={c.author}
            createdAt={c.createdAt}
            editedAt={c.editedAt}
            extra={
              !isReply && replies.length > 0 ? (
                <button type="button" onClick={() => setCollapsed(!collapsed)} className={`${linkButton} ml-2`} aria-expanded={!collapsed}>
                  [{collapsed ? `+ ${replies.length} ${replies.length === 1 ? "reply" : "replies"}` : "–"}]
                </button>
              ) : null
            }
          />
          {editing ? (
            <div className="mt-1">
              <Composer
                target={target}
                parentId={c.id}
                initial={c.body}
                submitLabel="Save"
                onCancel={() => setEditing(false)}
                onDone={(b) => {
                  setEditing(false);
                  onChange({ ...c, body: String(b), editedAt: new Date().toISOString() });
                }}
              />
            </div>
          ) : c.deleted ? (
            <p className="mt-0.5 text-sm italic text-subtle">[deleted]</p>
          ) : (
            <PlainText text={c.body} className="mt-0.5" />
          )}
          {!c.deleted && !editing && (
            <div className="mt-1 flex flex-wrap gap-3">
              {!isReply && (
                <button type="button" className={linkButton} onClick={() => (user?.username ? setReplying(!replying) : onNeedSignIn())}>
                  reply
                </button>
              )}
              {mine && (
                <>
                  <button type="button" className={linkButton} onClick={() => setEditing(true)}>
                    edit
                  </button>
                  <button
                    type="button"
                    className={linkButton}
                    onClick={async () => {
                      if (!confirm("Delete this comment?")) return;
                      const r = await api(`/api/community/comments/${c.id}`, { method: "DELETE" });
                      if (r.ok) onChange(replies.length ? { ...c, deleted: true, body: "", author: null } : null);
                    }}
                  >
                    delete
                  </button>
                </>
              )}
              {!mine && <ReportLink kind="comment" id={c.id} onNeedSignIn={onNeedSignIn} />}
            </div>
          )}
          {replying && (
            <div className="mt-2">
              <Composer
                target={target}
                parentId={c.id}
                submitLabel="Reply"
                onCancel={() => setReplying(false)}
                onDone={(n) => {
                  setReplying(false);
                  setCollapsed(false);
                  onChange({ ...c, replies: [...replies, n as CommentItem] });
                }}
              />
            </div>
          )}
          {!collapsed && replies.length > 0 && (
            <ul className="ml-1 border-l border-line pl-3">
              {replies.map((r) => (
                <CommentRow
                  key={r.id}
                  c={r}
                  target={target}
                  votes={votes}
                  isReply
                  onNeedSignIn={onNeedSignIn}
                  onChange={(next) => onChange({ ...c, replies: next ? replies.map((x) => (x.id === r.id ? next : x)) : replies.filter((x) => x.id !== r.id) })}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

export default function Comments({ target, onCount }: { target: string; onCount?: (n: number) => void }) {
  const { user } = useMe();
  const [sort, setSort] = useState<Sort>("top");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<List | null>(null);
  const [err, setErr] = useState("");
  const [votes, setVotes] = useState<Record<string, VoteValue>>({});
  const [askSignIn, setAskSignIn] = useState(false);

  const load = useCallback(
    async (s: Sort, p: number) => {
      const r = await api<List>(`/api/community/comments?target=${encodeURIComponent(target)}&sort=${s}&page=${p}`);
      if (!r.ok) return setErr(r.status === 503 ? "Comments aren't switched on yet." : r.error);
      setErr("");
      setList((prev) => (p > 1 && prev ? { ...r, items: [...prev.items, ...r.items.filter((i) => !prev.items.some((x) => x.id === i.id))] } : r));
      onCount?.(r.total);
    },
    [target, onCount],
  );

  useEffect(() => {
    void load(sort, page);
  }, [load, sort, page]);

  // Your own arrows, once per list, only when signed in.
  const ids = (list?.items ?? []).flatMap((c) => [c.id, ...(c.replies ?? []).map((r) => r.id)]);
  const idKey = ids.join(",");
  useEffect(() => {
    if (!user || !idKey) return;
    void myVotes("comment", idKey.split(",")).then((v) => setVotes((old) => ({ ...old, ...v })));
  }, [user, idKey]);

  const needSignIn = () => setAskSignIn(true);
  const update = (id: string, next: CommentItem | null) => setList((l) => (l ? { ...l, items: next ? l.items.map((x) => (x.id === id ? next : x)) : l.items.filter((x) => x.id !== id) } : l));

  return (
    <div>
      <div className="mb-2">
        {user?.username ? (
          <Composer
            target={target}
            submitLabel="Comment"
            onDone={(c) => {
              const item = { ...(c as CommentItem), author: { username: user.username!, karma: user.karma, expert: user.expert }, replies: [] };
              setList((l) => ({ items: [item, ...(l?.items ?? [])], hasMore: l?.hasMore ?? false, total: (l?.total ?? 0) + 1 }));
            }}
          />
        ) : (
          <SignInBox prompt={askSignIn ? "You need to sign in for that." : "Sign in to comment and vote."} />
        )}
      </div>
      <div className="flex items-center justify-between border-b border-line pb-1">
        <span className="text-xs text-muted">{list ? `${list.total} comment${list.total === 1 ? "" : "s"}` : "Loading comments…"}</span>
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
      {list && !list.items.length && !err && <p className="py-3 text-sm text-muted">No comments yet. Start the conversation.</p>}
      {list && (
        <ul>
          {list.items.map((c) => (
            <CommentRow key={c.id} c={c} target={target} votes={votes} onNeedSignIn={needSignIn} onChange={(n) => update(c.id, n)} />
          ))}
        </ul>
      )}
      {list?.hasMore && (
        <button type="button" onClick={() => setPage(page + 1)} className={`${linkButton} mt-2`}>
          more comments
        </button>
      )}
    </div>
  );
}
