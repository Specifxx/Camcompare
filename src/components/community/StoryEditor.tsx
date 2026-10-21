"use client";
// /stories/new: the signed-in editor for a member story, with a preview that
// renders exactly what the story page will. ?product=<slug> starts with that
// product linked; ?edit=<id> edits your own story. An unsent draft is kept
// in this browser (localStorage) so a closed tab doesn't lose an hour of
// writing.
import { useEffect, useMemo, useState } from "react";
import { coverUrl, STORY_BODY_MAX, STORY_BODY_MIN, STORY_PRODUCTS_MAX, STORY_TAGS, STORY_TAGS_MAX, STORY_TITLE_MAX, STORY_VERDICT_MAX, storyPath, type StoryTag } from "@/lib/community/stories";
import { ID_RE, SLUG_RE } from "@/lib/community/rules";
import ProductPicker, { useCatalogIndex } from "../ProductPicker";
import { SignInBox } from "./bits";
import { api, inputClass, linkButton, useMe } from "./client";
import StoryBody from "./StoryBody";

type Draft = { title: string; body: string; verdict: string; cover: string; tags: StoryTag[]; products: string[] };
const EMPTY: Draft = { title: "", body: "", verdict: "", cover: "", tags: ["review"], products: [] };
const DRAFT_KEY = "cc_story_draft_v1";

const TEMPLATE = `## What I bought and why

## How it handles

## Image quality

## What I'd change

`;

function readDraft(): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as Draft | null;
    return d && typeof d.body === "string" ? { ...EMPTY, ...d } : null;
  } catch {
    return null;
  }
}
function writeDraft(d: Draft | null) {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage blocked: no draft kept */
  }
}

export default function StoryEditor() {
  const { user, loaded } = useMe();
  const index = useCatalogIndex();
  const [editId, setEditId] = useState<string | null>(null);
  const [d, setD] = useState<Draft>(EMPTY);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const edit = sp.get("edit");
    if (edit && ID_RE.test(edit)) {
      setEditId(edit);
      return;
    }
    const draft = readDraft();
    const p = sp.get("product");
    const start = draft ?? EMPTY;
    setD(p && SLUG_RE.test(p) && !start.products.includes(p) ? { ...start, products: [...start.products, p].slice(0, STORY_PRODUCTS_MAX) } : start);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!editId || !user?.username) return;
    void api<{ story: { title: string; body: string; verdict: string | null; cover: string | null; tags: StoryTag[]; products: string[] } }>(`/api/community/stories/${editId}/own`).then((r) => {
      if (!r.ok) return setErr(r.error);
      setD({ title: r.story.title, body: r.story.body, verdict: r.story.verdict ?? "", cover: r.story.cover ?? "", tags: r.story.tags, products: r.story.products });
      setReady(true);
    });
  }, [editId, user?.username]);

  useEffect(() => {
    if (ready && !editId) writeDraft(d.title || d.body || d.verdict ? d : null);
  }, [d, ready, editId]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const coverOk = !d.cover.trim() || coverUrl(d.cover) !== null;
  const chars = d.body.trim().length;
  const problems = useMemo(() => {
    const p: string[] = [];
    if (d.title.trim().length < 8) p.push("a title of at least 8 characters");
    if (chars < STORY_BODY_MIN) p.push(`at least ${STORY_BODY_MIN} characters of story (${chars} so far)`);
    if (!d.tags.length) p.push("a tag");
    if (!coverOk) p.push("an https:// cover image address, or none");
    return p;
  }, [d, chars, coverOk]);

  if (!loaded) return <p className="text-sm text-muted">Loading…</p>;
  if (!user?.username)
    return (
      <div className="space-y-2">
        <p className="text-sm">Member stories are written by signed-in members, so readers know who is talking.</p>
        <SignInBox prompt="Sign in to write a story." />
      </div>
    );
  if (!ready) return <p className="text-sm text-muted">{err || "Loading your story…"}</p>;

  const submit = async () => {
    setBusy(true);
    setErr("");
    const body = { title: d.title, body: d.body, verdict: d.verdict, cover: d.cover.trim(), tags: d.tags, products: d.products };
    const r = editId ? await api<{ id: string }>(`/api/community/stories/${editId}`, { method: "PATCH", body }) : await api<{ id: string }>("/api/community/stories", { method: "POST", body });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    if (!editId) writeDraft(null);
    location.href = storyPath(r.id);
  };

  const tabBtn = (k: "write" | "preview", label: string) => (
    <button type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`border-b-2 px-1 pb-1 text-sm ${tab === k ? "border-accent font-semibold text-fg" : "border-transparent text-muted hover:text-fg"}`}>
      {label}
    </button>
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!problems.length) void submit();
      }}
    >
      <label className="block text-sm">
        <span className="font-semibold">Title</span>
        <input value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={STORY_TITLE_MAX} placeholder="e.g. Six months with the Ricoh GR IIIx on the street" className={`${inputClass} mt-1 text-base`} />
      </label>

      <fieldset>
        <legend className="text-sm font-semibold">Tags (up to {STORY_TAGS_MAX})</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {STORY_TAGS.map((t) => {
            const on = d.tags.includes(t.slug);
            return (
              <button
                key={t.slug}
                type="button"
                aria-pressed={on}
                onClick={() => set("tags", on ? d.tags.filter((x) => x !== t.slug) : [...d.tags, t.slug].slice(-STORY_TAGS_MAX))}
                className={`rounded border px-2 py-0.5 text-xs ${on ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line text-muted hover:text-fg"}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        {d.products.length < STORY_PRODUCTS_MAX && <ProductPicker label={`Products it's about (up to ${STORY_PRODUCTS_MAX})`} exclude={d.products} onPick={(r) => set("products", [...d.products, r.s])} />}
        {d.products.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {d.products.map((s) => (
              <li key={s} className="flex items-center gap-1 rounded border border-line px-2 py-0.5 text-xs">
                {index.get(s)?.n ?? s}
                <button type="button" aria-label={`Remove ${index.get(s)?.n ?? s}`} onClick={() => set("products", d.products.filter((x) => x !== s))} className="text-subtle hover:text-warn">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-subtle">The story shows under &ldquo;Member stories&rdquo; on these products&apos; pages.</p>
      </div>

      <div>
        <div role="tablist" className="flex gap-4 border-b border-line">
          {tabBtn("write", "Write")}
          {tabBtn("preview", "Preview")}
        </div>
        {tab === "write" ? (
          <>
            <textarea value={d.body} onChange={(e) => set("body", e.target.value)} maxLength={STORY_BODY_MAX} rows={18} placeholder={TEMPLATE} className={`${inputClass} mt-2 font-mono text-[13px] leading-relaxed`} aria-label="Story" />
            <div className="flex flex-wrap justify-between gap-2 text-xs text-subtle">
              <span>
                <code>## Heading</code> · <code>**bold**</code> · <code>*italic*</code> · <code>- list</code> · <code>&gt; quote</code> · <code>[link](https://…)</code>. No HTML, no pictures in the text.
              </span>
              <span className={chars < STORY_BODY_MIN ? "text-warn" : ""}>
                {chars.toLocaleString("en-US")} / {STORY_BODY_MAX.toLocaleString("en-US")}
              </span>
            </div>
            {!d.body && (
              <button type="button" className={`${linkButton} mt-1`} onClick={() => set("body", TEMPLATE)}>
                start from a review outline
              </button>
            )}
          </>
        ) : (
          <div className="mt-3 min-h-[12rem]">
            <h2 className="text-2xl font-semibold leading-tight">{d.title || "Your title"}</h2>
            <div className="mt-3">{d.body.trim() ? <StoryBody text={d.body} /> : <p className="text-sm text-muted">Nothing to preview yet.</p>}</div>
            {d.verdict.trim() && (
              <aside className="mt-5 rounded-md border border-line bg-raised p-3">
                <p className="eyebrow">Verdict</p>
                <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed">{d.verdict}</p>
              </aside>
            )}
          </div>
        )}
      </div>

      <label className="block text-sm">
        <span className="font-semibold">Verdict (optional)</span>
        <span className="block text-xs text-muted">Two or three sentences: who should buy it, and who shouldn&apos;t.</span>
        <textarea value={d.verdict} onChange={(e) => set("verdict", e.target.value)} maxLength={STORY_VERDICT_MAX} rows={3} className={`${inputClass} mt-1`} />
      </label>

      <label className="block text-sm">
        <span className="font-semibold">Cover image address (optional)</span>
        <span className="block text-xs text-muted">An https:// link to a photo you took and host yourself. We can&apos;t store uploads. It appears once the site owner features your story.</span>
        <input value={d.cover} onChange={(e) => set("cover", e.target.value)} maxLength={500} inputMode="url" placeholder="https://…" className={`${inputClass} mt-1 ${coverOk ? "" : "border-warn"}`} />
      </label>

      {err && (
        <p role="alert" className="text-sm text-warn">
          {err}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <button type="submit" disabled={busy || problems.length > 0} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
          {busy ? "Saving…" : editId ? "Save changes" : "Publish story"}
        </button>
        <a href={editId ? storyPath(editId) : "/stories"} className={linkButton}>
          cancel
        </a>
        {problems.length > 0 && <span className="text-xs text-muted">Still needs {problems.join(", ")}.</span>}
      </div>
      <p className="text-xs text-subtle">
        Write about gear you&apos;ve used yourself. Stories are public under your username; search engines see one only once the owner features it.{editId ? " Saving an edit takes a featured story off the featured list until the owner looks again." : ""}
      </p>
    </form>
  );
}
