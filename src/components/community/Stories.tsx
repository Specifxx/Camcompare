"use client";
// The member stories list on /stories: featured stories first (the owner's
// pick), then top or new, with a tag filter and paging. Loads from the
// CDN-cached /api/community/stories after the static page renders.
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MARKETS } from "@/lib/markets";
import { useMarket } from "@/lib/market-client";
import { SORTS, type Sort, type VoteValue } from "@/lib/community/rules";
import { STORY_TAGS, storyPath, tagLabel, type StoryListItem, type StoryTag } from "@/lib/community/stories";
import type { SearchRow } from "@/lib/search";
import { productHref, useCatalogIndex } from "../ProductPicker";
import { AuthorLine, SignInBox, SortTabs, VoteArrows } from "./bits";
import { api, linkButton, myVotes, useMe } from "./client";

export function ProductLinks({ slugs, index, prefix }: { slugs: string[]; index: Map<string, SearchRow>; prefix: string }) {
  const rows = slugs.map((s) => index.get(s)).filter((r): r is SearchRow => Boolean(r));
  if (!rows.length) return null;
  return (
    <span className="text-xs text-muted">
      About{" "}
      {rows.map((r, i) => (
        <span key={r.s}>
          {i > 0 && ", "}
          <a href={productHref(r, prefix)}>{r.n}</a>
        </span>
      ))}
    </span>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  return (
    <span className="text-xs text-subtle">
      {tags.map((t, i) => (
        <span key={t}>
          {i > 0 && " · "}
          {tagLabel(t)}
        </span>
      ))}
    </span>
  );
}

/** A featured story's cover: a remote image, loaded lazily with no referrer. */
export function Cover({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={`rounded-md bg-raised object-cover ${className}`} />;
}

export function StoryRow({ s, mine, own, index, prefix, onNeedSignIn }: { s: StoryListItem; mine: VoteValue; own: boolean; index: Map<string, SearchRow>; prefix: string; onNeedSignIn?: () => void }) {
  return (
    <li className="flex gap-2 border-b border-line py-3">
      <VoteArrows kind="post" target={s.id} score={s.score} mine={mine} disabled={own} onNeedSignIn={onNeedSignIn} />
      <div className="min-w-0 flex-1">
        <p className="text-xs">
          {s.featured && <span className="mr-2 font-semibold text-win">Featured</span>}
          <TagList tags={s.tags} />
        </p>
        <a href={storyPath(s.id)} className="block font-semibold text-fg">
          {s.title}
        </a>
        <p className="mt-0.5 text-sm text-muted">{s.excerpt}</p>
        <AuthorLine
          author={s.author}
          createdAt={s.createdAt}
          extra={
            <span className="text-subtle">
              {" "}
              · {s.minutes} min read ·{" "}
              <a href={`${storyPath(s.id)}#comments`} className="text-muted">
                {s.comments} {s.comments === 1 ? "comment" : "comments"}
              </a>
            </span>
          }
        />
        <ProductLinks slugs={s.products} index={index} prefix={prefix} />
      </div>
      {s.cover && <Cover src={s.cover} alt="" className="hidden h-20 w-28 shrink-0 sm:block" />}
    </li>
  );
}

export default function Stories() {
  const { user } = useMe();
  const m = useMarket(usePathname() ?? "/stories");
  const prefix = MARKETS[m].prefix;
  const index = useCatalogIndex();
  const [sort, setSort] = useState<Sort>("top");
  const [tag, setTag] = useState<StoryTag | null>(null);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<StoryListItem[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [err, setErr] = useState("");
  const [votes, setVotes] = useState<Record<string, VoteValue>>({});
  const [askSignIn, setAskSignIn] = useState(false);

  const load = useCallback(async (s: Sort, t: StoryTag | null, p: number) => {
    const r = await api<{ items: StoryListItem[]; hasMore: boolean }>(`/api/community/stories?sort=${s}&page=${p}${t ? `&tag=${t}` : ""}`);
    if (!r.ok) return setErr(r.status === 503 ? "Member stories aren't switched on yet. Please check back soon." : r.error);
    setErr("");
    setItems((prev) => (p > 1 && prev ? [...prev, ...r.items] : r.items));
    setHasMore(r.hasMore);
  }, []);
  useEffect(() => {
    void load(sort, tag, page);
  }, [load, sort, tag, page]);

  const idKey = (items ?? []).map((s) => s.id).join(",");
  useEffect(() => {
    if (!user || !idKey) return;
    void myVotes("post", idKey.split(",")).then((v) => setVotes((o) => ({ ...o, ...v })));
  }, [user, idKey]);

  const reset = () => {
    setPage(1);
    setItems(null);
  };

  return (
    <div>
      <div className="mb-3">
        {user?.username ? (
          <a href="/stories/new" className="btn-primary px-3 py-1.5 text-sm">
            Write a story
          </a>
        ) : (
          <SignInBox prompt={askSignIn ? "You need to sign in for that." : "Sign in to write a story, comment and vote."} next="/stories/new" />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-1">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs" role="group" aria-label="Filter by tag">
          {[null, ...STORY_TAGS.map((t) => t.slug)].map((t) => (
            <button
              key={t ?? "all"}
              type="button"
              aria-pressed={tag === t}
              onClick={() => {
                setTag(t);
                reset();
              }}
              className={tag === t ? "font-semibold text-fg" : "text-muted hover:text-fg hover:underline"}
            >
              {t ? tagLabel(t) : "All"}
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
      {!items && !err && <p className="py-3 text-sm text-muted">Loading stories…</p>}
      {items && !items.length && !err && <p className="py-3 text-sm text-muted">No stories here yet. Write the first one.</p>}
      <ol>
        {items?.map((s) => (
          <StoryRow key={s.id} s={s} mine={votes[s.id] ?? 0} own={Boolean(user?.username && s.author?.username === user.username)} index={index} prefix={prefix} onNeedSignIn={() => setAskSignIn(true)} />
        ))}
      </ol>
      {hasMore && (
        <button type="button" onClick={() => setPage(page + 1)} className={`${linkButton} mt-2`}>
          more stories
        </button>
      )}
    </div>
  );
}
