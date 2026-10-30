// Evergreen guides: Markdown files in content/guides/<slug>.md with a small
// frontmatter block (title, description, updated). Rendered to HTML at build.
import fs from "node:fs";
import path from "node:path";
import { Marked } from "marked";

const DIR = path.join(process.cwd(), "content", "guides");

// `date` is when a post was first published (falls back to `updated`); `kind`
// "blog" marks a best-of list or opinion post, "guide" an evergreen explainer.
export type Guide = { slug: string; title: string; description: string; date: string; updated: string; kind: "blog" | "guide"; /** A product slug whose photo goes on the post's home-page card. */ hero?: string; body: string; words: number };

// Site-internal links only (the writers' rule). marked doesn't sanitize, so
// the renderer enforces it: a link or image whose target isn't a path on this
// site ("/x", never "//host" or "/\host") renders as its text, and raw HTML
// renders as escaped text, so no guide ships an external link or a script.
// Returning false hands an internal one to marked's own renderer.
const internal = (href: string) => /^\/(?![/\\])/.test(href);
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const md = new Marked({
  async: false,
  renderer: {
    link: (href, _title, text) => (internal(href) ? false : text),
    image: (href, _title, text) => (internal(href) ? false : text),
    html: (html) => escapeHtml(html),
  },
});
export const guideHtml = (body: string) => md.parse(body) as string;

function parse(slug: string, raw: string): Guide {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta: Record<string, string> = {};
  for (const line of (m?.[1] ?? "").split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  const body = m?.[2] ?? raw;
  const updated = meta.updated ?? "";
  // A live block (a table of picks or specs) reads like ~60 words.
  const words = body.replace(/^\[\[[^\]]+\]\]$/gm, "").split(/\s+/).filter(Boolean).length + 60 * (body.match(/^\[\[/gm)?.length ?? 0);
  return { slug, title: meta.title ?? slug, description: meta.description ?? "", date: meta.date ?? updated, updated, kind: meta.kind === "blog" ? "blog" : "guide", ...(meta.hero ? { hero: meta.hero } : {}), body, words };
}

let memo: Guide[] | null = null;
export function guides(): Guide[] {
  if (memo) return memo;
  memo = fs.existsSync(DIR)
    ? fs.readdirSync(DIR).filter((f) => f.endsWith(".md")).sort().map((f) => parse(f.slice(0, -3), fs.readFileSync(path.join(DIR, f), "utf8")))
    : [];
  return memo;
}
export const guide = (slug: string) => guides().find((g) => g.slug === slug) ?? null;
/** Newest first: publish date, then last update. What the home page and /guides lead with. */
export const latestGuides = () => [...guides()].sort((a, b) => b.date.localeCompare(a.date) || b.updated.localeCompare(a.updated) || a.title.localeCompare(b.title));
