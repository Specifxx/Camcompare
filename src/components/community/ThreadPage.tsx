"use client";
// One thread, client-rendered: /community/t/<id> is served by the static
// /community/t shell (a rewrite in next.config.js), which reads the id from
// the address. The post, its votes and its comments (target "thread:<id>").
import { useEffect, useState } from "react";
import { boardName, ID_RE, THREAD_BODY_MAX, THREAD_TITLE_MAX, type ThreadItem, type VoteValue } from "@/lib/community/rules";
import { AuthorLine, PlainText, ReportLink, VoteArrows } from "./bits";
import { api, inputClass, linkButton, myVotes, useMe } from "./client";
import Comments from "./Comments";

export default function ThreadPage() {
  const { user } = useMe();
  const [id, setId] = useState<string | null>(null);
  const [t, setT] = useState<ThreadItem | null>(null);
  const [err, setErr] = useState("");
  const [mine, setMine] = useState<VoteValue>(0);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    const m = location.pathname.match(/^\/community\/t\/([^/]+)\/?$/);
    const tid = m && ID_RE.test(m[1]) ? m[1] : null;
    setId(tid);
    if (!tid) return setErr("That thread doesn't exist.");
    void api<{ thread: ThreadItem }>(`/api/community/threads/${tid}`).then((r) => {
      if (!r.ok) return setErr(r.error);
      setT(r.thread);
      document.title = `${r.thread.title} | CamCompare community`;
    });
  }, []);

  useEffect(() => {
    if (user && id) void myVotes("thread", [id]).then((v) => setMine(v[id] ?? 0));
  }, [user, id]);

  if (err)
    return (
      <p className="text-sm text-muted">
        {err} <a href="/community">Back to the boards</a>
      </p>
    );
  if (!t || !id) return <p className="text-sm text-muted">Loading…</p>;
  const own = Boolean(user?.username && t.author?.username === user.username);

  return (
    <div>
      <p className="mb-2 text-xs text-muted">
        <a href="/community">Community</a> › <a href={`/community/${t.board}`}>{boardName(t.board)}</a>
      </p>
      <article className="flex gap-2 border-b border-line pb-3">
        {!t.deleted && <VoteArrows kind="thread" target={id} score={t.score} mine={mine} disabled={own} />}
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await api<{ title: string; body: string }>(`/api/community/threads/${id}`, { method: "PATCH", body: { title, body } });
                if (!r.ok) return alert(r.error);
                setT({ ...t, title: r.title, body: r.body, editedAt: new Date().toISOString() });
                setEditing(false);
              }}
            >
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={THREAD_TITLE_MAX} className={inputClass} />
              <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={THREAD_BODY_MAX} rows={6} className={inputClass} />
              <div className="flex gap-3">
                <button type="submit" className="btn-primary px-3 py-1 text-xs">
                  Save
                </button>
                <button type="button" onClick={() => setEditing(false)} className={linkButton}>
                  cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <h1 className="text-xl font-semibold">{t.title}</h1>
              <AuthorLine author={t.author} createdAt={t.createdAt} editedAt={t.editedAt} />
              {t.body && <PlainText text={t.body} className="mt-2" />}
              {!t.deleted && (
                <div className="mt-2 flex gap-3">
                  {own ? (
                    <>
                      <button
                        type="button"
                        className={linkButton}
                        onClick={() => {
                          setTitle(t.title);
                          setBody(t.body);
                          setEditing(true);
                        }}
                      >
                        edit
                      </button>
                      <button
                        type="button"
                        className={linkButton}
                        onClick={async () => {
                          if (!confirm("Delete this thread? Replies stay.")) return;
                          const r = await api(`/api/community/threads/${id}`, { method: "DELETE" });
                          if (r.ok) setT({ ...t, deleted: true, title: "[deleted]", body: "", author: null });
                        }}
                      >
                        delete
                      </button>
                    </>
                  ) : (
                    <ReportLink kind="thread" id={id} />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </article>
      <div className="mt-4">{t.deleted ? <p className="text-sm text-muted">This thread was deleted, so it&apos;s closed to new comments.</p> : null}</div>
      <Comments target={`thread:${id}`} />
    </div>
  );
}
