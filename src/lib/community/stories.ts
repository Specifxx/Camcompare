// Member stories (/stories): long reviews, guides and first impressions
// written by members, like a shop's product-review blog. The pure,
// client-safe half: limits, tags, the cover-image rule and a small Markdown
// subset parsed into a tree that components render as React elements, never
// as HTML. Bodies are stored as typed (after sanitizeText strips any tags),
// so the parser is the only thing that decides what is a heading or a link.
//
// The subset: "## " and "### " headings ("# " counts as "##": the page title
// is the only h1), paragraphs, "- " and "1. " lists, "> " quotes, "---"
// rules, **bold**, *italic*, `code`, [text](https://…) and bare http(s)
// links. Image syntax becomes a plain link: pictures in a body are not
// shown (DECISIONS.md, "Member stories and My gear").
import { linkSegments, type Author } from "./rules";

export const STORY_TAGS = [
  { slug: "review", label: "Review" },
  { slug: "guide", label: "Guide" },
  { slug: "first-impressions", label: "First impressions" },
  { slug: "deal-tip", label: "Deal tip" },
  { slug: "comparison", label: "Comparison" },
] as const;
export type StoryTag = (typeof STORY_TAGS)[number]["slug"];
export const STORY_TAG_SLUGS = STORY_TAGS.map((t) => t.slug) as [StoryTag, ...StoryTag[]];
export const isStoryTag = (s: unknown): s is StoryTag => typeof s === "string" && (STORY_TAG_SLUGS as readonly string[]).includes(s);
export const tagLabel = (s: string) => STORY_TAGS.find((t) => t.slug === s)?.label ?? s;

export const STORY_TITLE_MIN = 8;
export const STORY_TITLE_MAX = 140;
export const STORY_BODY_MIN = 200;
export const STORY_BODY_MAX = 30_000;
export const STORY_VERDICT_MAX = 600;
export const STORY_TAGS_MAX = 3;
export const STORY_PRODUCTS_MAX = 6;
export const COVER_URL_MAX = 500;
/** New stories per member per day, across instances (counted in the database). */
export const STORIES_PER_DAY = 3;
/** Stories a product page shows. */
export const PRODUCT_STORIES_MAX = 5;

export const storyPath = (id: string) => `/stories/p/${id}`;

/**
 * A cover image address members may give: https only, a real host name (no
 * IP literal, no localhost, no user:password@), at most COVER_URL_MAX
 * characters. Null for anything else. It is shown only once the owner has
 * featured the story, with no referrer and lazy loading.
 */
export function coverUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > COVER_URL_MAX) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || h.endsWith(".local") || h.endsWith(".internal") || h === "localhost" || /^[\d.]+$/.test(h) || h.startsWith("[")) return null;
  return u.toString();
}

// ---------------------------------------------------------------- Markdown subset

export type Inline = { t: "text"; v: string } | { t: "b"; c: Inline[] } | { t: "i"; c: Inline[] } | { t: "code"; v: string } | { t: "a"; href: string; c: Inline[] };
export type Block =
  | { t: "h2"; c: Inline[] }
  | { t: "h3"; c: Inline[] }
  | { t: "p"; lines: Inline[][] }
  | { t: "ul"; items: Inline[][] }
  | { t: "ol"; items: Inline[][] }
  | { t: "quote"; lines: Inline[][] }
  | { t: "hr" };

/** An http(s) URL as a link target, or null (javascript:, data:, relative paths and the rest). */
export function safeHref(raw: string): string | null {
  try {
    const u = new URL(raw);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".") && !u.username && !u.password ? u.toString() : null;
  } catch {
    return null;
  }
}

function textRuns(s: string): Inline[] {
  return linkSegments(s).map((g) => (g.type === "link" ? { t: "a" as const, href: g.href, c: [{ t: "text" as const, v: g.text }] } : { t: "text" as const, v: g.text }));
}

const INLINE_RE = /`([^`\n]+)`|!\[([^\]\n]*)\]\(([^()\s]+)\)|\[([^\]\n]+)\]\(([^()\s]+)\)|\*\*([^\n]+?)\*\*|\*([^*\n]+?)\*/g;

/** One line's inline marks. Nesting stops at depth 3; whatever isn't a mark stays text. */
export function parseInline(s: string, depth = 0): Inline[] {
  if (depth > 3) return [{ t: "text", v: s }];
  const out: Inline[] = [];
  let at = 0;
  for (const m of s.matchAll(new RegExp(INLINE_RE.source, "g"))) {
    const start = m.index ?? 0;
    if (start > at) out.push(...textRuns(s.slice(at, start)));
    at = start + m[0].length;
    if (m[1] !== undefined) out.push({ t: "code", v: m[1] });
    else if (m[3] !== undefined) {
      const href = safeHref(m[3]);
      const label = `${m[2]?.trim() || "image"} (image link)`;
      out.push(href ? { t: "a", href, c: [{ t: "text", v: label }] } : { t: "text", v: m[0] });
    } else if (m[5] !== undefined) {
      const href = safeHref(m[5]);
      const inner = parseInline(m[4], depth + 1).map((x) => (x.t === "a" ? { t: "text" as const, v: plainOf([x]) } : x));
      out.push(href ? { t: "a", href, c: inner } : { t: "text", v: m[0] });
    } else if (m[6] !== undefined) out.push({ t: "b", c: parseInline(m[6], depth + 1) });
    else if (m[7] !== undefined) out.push({ t: "i", c: parseInline(m[7], depth + 1) });
  }
  if (at < s.length) out.push(...textRuns(s.slice(at)));
  return out;
}

/** The blocks of a story body. Never throws; anything unrecognised is a paragraph. */
export function parseStory(md: string): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  const flush = () => {
    if (cur) blocks.push(cur);
    cur = null;
  };
  for (const raw of md.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) {
      flush();
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*$/))) {
      flush();
      blocks.push({ t: m[1].length <= 2 ? "h2" : "h3", c: parseInline(m[2]) });
    } else if (/^\s{0,3}([-*_])(\s*\1){2,}$/.test(line)) {
      flush();
      blocks.push({ t: "hr" });
    } else if ((m = line.match(/^\s{0,3}[-*+]\s+(.*)$/))) {
      if (cur?.t !== "ul") flush();
      cur ??= { t: "ul", items: [] };
      (cur as { items: Inline[][] }).items.push(parseInline(m[1]));
    } else if ((m = line.match(/^\s{0,3}\d{1,3}[.)]\s+(.*)$/))) {
      if (cur?.t !== "ol") flush();
      cur ??= { t: "ol", items: [] };
      (cur as { items: Inline[][] }).items.push(parseInline(m[1]));
    } else if ((m = line.match(/^\s{0,3}>\s?(.*)$/))) {
      if (cur?.t !== "quote") flush();
      cur ??= { t: "quote", lines: [] };
      (cur as { lines: Inline[][] }).lines.push(parseInline(m[1]));
    } else {
      if (cur?.t !== "p") flush();
      cur ??= { t: "p", lines: [] };
      (cur as { lines: Inline[][] }).lines.push(parseInline(line.trim()));
    }
  }
  flush();
  return blocks;
}

/** The text of inline runs with every mark dropped. */
export function plainOf(xs: Inline[]): string {
  return xs.map((x) => (x.t === "text" || x.t === "code" ? x.v : plainOf(x.c))).join("");
}

/** A plain-text excerpt of a body (for lists and descriptions), cut at a word. */
export function storyExcerpt(md: string, max = 240): string {
  const text = parseStory(md)
    .map((b) => (b.t === "hr" ? "" : b.t === "h2" || b.t === "h3" ? plainOf(b.c) : b.t === "p" || b.t === "quote" ? b.lines.map(plainOf).join(" ") : b.items.map(plainOf).join("; ")))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s.,;:!?-]+$/, "")}…`;
}

/** Roughly how long a body takes to read, at 230 words a minute. */
export const readMinutes = (md: string) => Math.max(1, Math.round(md.split(/\s+/).filter(Boolean).length / 230));

// ---------------------------------------------------------------- shapes the API returns


export type StoryListItem = {
  id: string;
  createdAt: string;
  editedAt: string | null;
  title: string;
  excerpt: string;
  tags: StoryTag[];
  products: string[];
  featured: boolean;
  /** Only on featured stories. */
  cover: string | null;
  author: Author | null;
  score: number;
  comments: number;
  minutes: number;
};

export type StoryItem = StoryListItem & { body: string; verdict: string | null; deleted: boolean };
