"use client";
// <ProductStories slug="sony-a7-iv" name="α7 IV" />: "Member stories" on a
// product page, the stories that name this product (featured first). Loads
// only when scrolled near, from the CDN-cached /api/community/stories, so the
// static page stays static and most visits never reach the database.
import { useEffect, useRef, useState } from "react";
import { storyPath, tagLabel, type StoryListItem } from "@/lib/community/stories";
import { AuthorLine } from "./bits";
import { api, useNearViewport } from "./client";

export default function ProductStories({ slug, name }: { slug: string; /** The product's short name, for the heading. */ name?: string }) {
  const ref = useRef<HTMLElement>(null);
  const near = useNearViewport(ref);
  const [items, setItems] = useState<StoryListItem[] | null>(null);
  const [off, setOff] = useState(false);
  useEffect(() => {
    if (!near || items) return;
    void api<{ items: StoryListItem[] }>(`/api/community/stories?product=${encodeURIComponent(slug)}`).then((r) => {
      if (r.ok) setItems(r.items);
      else setOff(true);
    });
  }, [near, items, slug]);
  if (off) return null;
  const write = `/stories/new?product=${encodeURIComponent(slug)}`;
  return (
    <section ref={ref} id="member-stories" aria-labelledby="member-stories-h">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-1">
        <h2 id="member-stories-h" className="h-section">
          Member stories{name ? <span className="text-muted"> · {name}</span> : null}
        </h2>
        <a href={write} className="text-sm">
          Write one
        </a>
      </div>
      {!items ? (
        <p className="text-sm text-muted">Loading stories…</p>
      ) : !items.length ? (
        <p className="text-sm text-muted">
          No member stories yet. Own one? <a href={write}>Write a hands-on review</a>: what you shoot with it, what you like and what you&apos;d change.
        </p>
      ) : (
        <ul>
          {items.map((s) => (
            <li key={s.id} className="border-b border-line py-2">
              <p className="text-xs text-subtle">
                {s.featured && <span className="mr-2 font-semibold text-win">Featured</span>}
                {s.tags.map(tagLabel).join(" · ")}
              </p>
              <a href={storyPath(s.id)} className="font-semibold text-fg">
                {s.title}
              </a>
              <p className="text-sm text-muted">{s.excerpt}</p>
              <AuthorLine author={s.author} createdAt={s.createdAt} extra={<span className="text-subtle"> · {s.score} points · {s.comments} comments</span>} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-subtle">
        Members&apos; own words, not CamCompare&apos;s. <a href="/stories">All member stories</a>
      </p>
    </section>
  );
}
