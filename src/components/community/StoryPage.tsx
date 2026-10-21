"use client";
// One member story, client-rendered: /stories/p/<id> is served by the static
// /stories/p shell (a rewrite in next.config.js), which reads the id from
// the address. Unless the owner has featured it, the page adds a robots
// noindex tag as soon as it knows (the shell itself carries none, because
// a noindex in the first HTML would stop search engines from ever seeing a
// featured story). Comments are the usual Comments with target "post:<id>".
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MARKETS } from "@/lib/markets";
import { useMarket } from "@/lib/market-client";
import { ID_RE, type VoteValue } from "@/lib/community/rules";
import { storyPath, type StoryItem } from "@/lib/community/stories";
import { abs } from "@/lib/site";
import { productHref, useCatalogIndex } from "../ProductPicker";
import { AuthorLine, ReportLink, VoteArrows } from "./bits";
import { api, linkButton, myVotes, useMe } from "./client";
import Comments from "./Comments";
import StoryBody from "./StoryBody";
import { Cover, TagList } from "./Stories";

function setHead(opts: { index: boolean; title?: string; description?: string; canonical?: string }) {
  const put = (sel: string, make: () => HTMLElement, attr: string, value: string | null) => {
    let el = document.head.querySelector<HTMLElement>(sel);
    if (value === null) return el?.remove();
    if (!el) document.head.appendChild((el = make()));
    el.setAttribute(attr, value);
  };
  const meta = (name: string) => () => Object.assign(document.createElement("meta"), { name });
  put('meta[name="robots"]', meta("robots"), "content", opts.index ? null : "noindex, follow");
  if (opts.description !== undefined) put('meta[name="description"]', meta("description"), "content", opts.description);
  put('link[rel="canonical"]', () => Object.assign(document.createElement("link"), { rel: "canonical" }), "href", opts.canonical ?? null);
  if (opts.title) document.title = opts.title;
}

export default function StoryPage() {
  const { user } = useMe();
  const m = useMarket(usePathname() ?? "/stories");
  const prefix = MARKETS[m].prefix;
  const index = useCatalogIndex();
  const [id, setId] = useState<string | null>(null);
  const [s, setS] = useState<StoryItem | null>(null);
  const [err, setErr] = useState("");
  const [mine, setMine] = useState<VoteValue>(0);

  useEffect(() => {
    const mm = location.pathname.match(/^\/stories\/p\/([^/]+)\/?$/);
    const sid = mm && ID_RE.test(mm[1]) ? mm[1] : null;
    setId(sid);
    if (!sid) {
      setHead({ index: false });
      return setErr("That story doesn't exist.");
    }
    void api<{ story: StoryItem }>(`/api/community/stories/${sid}`).then((r) => {
      if (!r.ok) {
        setHead({ index: false });
        return setErr(r.status === 503 ? "Member stories aren't switched on yet. Please check back soon." : r.error);
      }
      setS(r.story);
      const featured = r.story.featured && !r.story.deleted;
      setHead({ index: featured, title: `${r.story.title} | CamCompare member stories`, description: r.story.excerpt, canonical: featured ? abs(storyPath(sid)) : undefined });
    });
  }, []);

  useEffect(() => {
    if (user && id) void myVotes("post", [id]).then((v) => setMine(v[id] ?? 0));
  }, [user, id]);

  if (err)
    return (
      <p className="text-sm text-muted">
        {err} <a href="/stories">All member stories</a>
      </p>
    );
  if (!s || !id) return <p className="text-sm text-muted">Loading…</p>;
  const own = Boolean(user?.username && s.author?.username === user.username);
  const products = s.products.map((x) => index.get(x)).filter((r) => r !== undefined);

  return (
    <div>
      <p className="mb-2 text-xs text-muted">
        <a href="/stories">Member stories</a>
        {s.featured && <span className="ml-2 font-semibold text-win">Featured</span>}
      </p>
      <article className="border-b border-line pb-4">
        <div className="flex gap-2">
          {!s.deleted && <VoteArrows kind="post" target={id} score={s.score} mine={mine} disabled={own} />}
          <div className="min-w-0 flex-1">
            <TagList tags={s.tags} />
            <h1 className="text-2xl font-semibold leading-tight">{s.title}</h1>
            <AuthorLine author={s.author} createdAt={s.createdAt} editedAt={s.editedAt} extra={!s.deleted && <span className="text-subtle"> · {s.minutes} min read</span>} />
          </div>
        </div>
        {s.cover && <Cover src={s.cover} alt="" className="mt-3 max-h-[28rem] w-full" />}
        {products.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {products.map((r) => (
              <li key={r.s}>
                <a href={productHref(r, prefix)} className="card flex items-center gap-2 px-2 py-1 text-sm no-underline hover:no-underline">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/products/${r.s}.webp`} alt="" width={40} height={30} loading="lazy" className="h-[30px] w-10 rounded bg-white object-contain" />
                  <span>{r.n}</span>
                  <span className="text-xs text-accent">prices</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {!s.deleted && (
          <div className="mt-4">
            <StoryBody text={s.body} />
          </div>
        )}
        {s.verdict && (
          <aside className="mt-5 rounded-md border border-line bg-raised p-3" aria-label="Verdict">
            <p className="eyebrow">Verdict</p>
            <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed">{s.verdict}</p>
          </aside>
        )}
        {!s.deleted && (
          <div className="mt-3 flex gap-3">
            {own ? (
              <>
                <a href={`/stories/new?edit=${id}`} className={linkButton}>
                  edit
                </a>
                <button
                  type="button"
                  className={linkButton}
                  onClick={async () => {
                    if (!confirm("Delete this story? Comments stay.")) return;
                    const r = await api(`/api/community/stories/${id}`, { method: "DELETE" });
                    if (r.ok) setS({ ...s, deleted: true, title: "[deleted]", body: "", verdict: null, author: null, cover: null, products: [] });
                  }}
                >
                  delete
                </button>
              </>
            ) : (
              <ReportLink kind="post" id={id} />
            )}
          </div>
        )}
      </article>
      <p className="mt-2 text-[11px] text-subtle">A member&apos;s own story and opinions, not CamCompare&apos;s. Votes never change the order of prices.</p>
      <div id="comments" className="mt-4">
        {s.deleted && <p className="mb-2 text-sm text-muted">This story was deleted, so it&apos;s closed to new comments.</p>}
        <Comments target={`post:${id}`} />
      </div>
    </div>
  );
}
