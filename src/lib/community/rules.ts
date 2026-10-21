// Community v1 (owner, 2026-10-17): comments on every listing, up/down votes,
// CamKarma, a CamExpert badge, discussion boards and user reviews. This file
// is the pure, client-safe half: limits, boards, the karma and badge rules,
// text cleaning, autolinking and vote arithmetic. No node:crypto, no
// database, no zod (that is lib/community/validate.ts), so client components
// can import it and tests/community.test.ts holds it.

// ---------------------------------------------------------------- karma and badge

/** CamKarma a member needs for the CamExpert badge. The UI shows this number. */
export const CAMEXPERT_KARMA = 50;
/** And the account must be at least this many days old. */
export const CAMEXPERT_MIN_ACCOUNT_DAYS = 14;
const DAY_MS = 86_400_000;

export type VoteKind = "comment" | "review" | "thread" | "deal" | "post" | "request";
/** "post": a member story (/stories); "request": a feature or gear request (/requests). */
export const VOTE_KINDS = ["comment", "review", "thread", "deal", "post", "request"] as const satisfies readonly VoteKind[];
/** What earns CamKarma: votes others cast on your comments and reviews. Never thread or deal votes. */
export const KARMA_KINDS: readonly VoteKind[] = ["comment", "review"];

/** CamKarma from the votes on one member's posts. Votes on deals (and threads) never count. */
export function karmaOf(votes: { kind: VoteKind; value: number }[]): number {
  return votes.reduce((sum, v) => (KARMA_KINDS.includes(v.kind) && (v.value === 1 || v.value === -1) ? sum + v.value : sum), 0);
}

export function isCamExpert(karma: number, accountCreatedAt: string | Date | null | undefined, now = Date.now()): boolean {
  if (!(karma >= CAMEXPERT_KARMA) || !accountCreatedAt) return false;
  const t = accountCreatedAt instanceof Date ? accountCreatedAt.getTime() : Date.parse(accountCreatedAt);
  return Number.isFinite(t) && now - t >= CAMEXPERT_MIN_ACCOUNT_DAYS * DAY_MS;
}

// ---------------------------------------------------------------- votes

export type VoteValue = -1 | 0 | 1;

/** Reddit's toggle: clicking the arrow you already chose removes your vote; the other arrow switches it. */
export function nextVote(current: VoteValue, clicked: 1 | -1): VoteValue {
  return current === clicked ? 0 : clicked;
}

/** A score after one member's vote changes from `prev` to `next` (for optimistic UI). */
export function applyVote(score: number, prev: VoteValue, next: VoteValue): number {
  return score - prev + next;
}

export const isVoteValue = (v: unknown): v is VoteValue => v === -1 || v === 0 || v === 1;

// ---------------------------------------------------------------- targets

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,119}$/;
/** A deal key is chosen by the deal feed: lowercase letters, digits and : _ . - (e.g. "us:sony-a7-iv:used"). */
export const DEAL_KEY_RE = /^[a-z0-9][a-z0-9:_.-]{0,119}$/;
export const ID_RE = /^[1-9][0-9]{0,17}$/;
/** Deal keys one GET /api/community/deals may ask for. */
export const DEAL_KEYS_MAX = 100;

export type Target = { kind: "product"; slug: string } | { kind: "deal"; key: string } | { kind: "thread"; id: string } | { kind: "post"; id: string } | { kind: "request"; id: string };

/** "product:<slug>", "deal:<dealKey>", "thread:<id>", "post:<id>" (a story) or "request:<id>"; anything else is null. */
export function parseTarget(raw: unknown): Target | null {
  if (typeof raw !== "string" || raw.length > 140) return null;
  const i = raw.indexOf(":");
  if (i < 0) return null;
  const kind = raw.slice(0, i);
  const rest = raw.slice(i + 1);
  if (kind === "product" && SLUG_RE.test(rest)) return { kind, slug: rest };
  if (kind === "deal" && DEAL_KEY_RE.test(rest)) return { kind, key: rest };
  if (kind === "thread" && ID_RE.test(rest)) return { kind, id: rest };
  if ((kind === "post" || kind === "request") && ID_RE.test(rest)) return { kind, id: rest };
  return null;
}

export const targetKey = (t: Target) => (t.kind === "product" ? `product:${t.slug}` : t.kind === "deal" ? `deal:${t.key}` : `${t.kind}:${t.id}`);

/** A comma list of deal keys from a query string: valid ones only, de-duplicated, at most DEAL_KEYS_MAX. */
export function parseDealKeys(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out = new Set<string>();
  for (const k of raw.split(",")) {
    const key = k.trim();
    if (DEAL_KEY_RE.test(key)) out.add(key);
    if (out.size >= DEAL_KEYS_MAX) break;
  }
  return [...out];
}

// ---------------------------------------------------------------- boards

export const BOARDS = [
  { slug: "general", name: "General", blurb: "Anything about cameras, lenses and photography that doesn't fit elsewhere." },
  { slug: "gear-advice", name: "Gear advice", blurb: "Which body, which lens, what to upgrade next: ask people who've used it." },
  { slug: "deals", name: "Deals", blurb: "A price worth sharing, a used bargain, or a deal to avoid." },
  { slug: "show-your-shots", name: "Show your shots", blurb: "Text only: the story behind a photo, the settings and the kit that made it." },
  { slug: "help", name: "Help", blurb: "Stuck with a setting, a firmware update or a fault? Ask here." },
] as const;
export type BoardSlug = (typeof BOARDS)[number]["slug"];
export const BOARD_SLUGS = BOARDS.map((b) => b.slug) as [BoardSlug, ...BoardSlug[]];
export const isBoard = (s: unknown): s is BoardSlug => typeof s === "string" && (BOARD_SLUGS as readonly string[]).includes(s);
export const boardName = (s: string) => BOARDS.find((b) => b.slug === s)?.name ?? s;

// ---------------------------------------------------------------- limits

export const COMMENT_MAX = 4000;
export const THREAD_TITLE_MIN = 5;
export const THREAD_TITLE_MAX = 140;
export const THREAD_BODY_MAX = 8000;
export const REVIEW_MIN = 20;
export const REVIEW_MAX = 5000;
export const REPORT_NOTE_MAX = 500;
export const PAGE_SIZE = 20;
/** The deepest page a list will serve: past it, the database would scan for nobody. */
export const PAGE_MAX = 50;
/** Distinct reporters that hide a post until the owner looks (the owner isn't always watching). */
export const AUTO_HIDE_REPORTS = 3;

export const SORTS = ["top", "new"] as const;
export type Sort = (typeof SORTS)[number];
export const isSort = (s: unknown): s is Sort => s === "top" || s === "new";

export const REPORT_REASONS = ["spam", "abuse", "off-topic", "misleading", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  spam: "Spam or advertising",
  abuse: "Abusive or hateful",
  "off-topic": "Off-topic",
  misleading: "Misleading or a scam",
  other: "Something else",
};

// ---------------------------------------------------------------- usernames

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
const USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{2,19}$/;
const RESERVED = new Set(["admin", "administrator", "mod", "moderator", "mods", "staff", "support", "owner", "official", "root", "system", "deleted", "removed", "null", "undefined", "anonymous", "help", "me", "you", "camexpert", "camkarma"]);

export type UsernameCheck = { ok: true; username: string; lower: string } | { ok: false; error: string };

/** 3 to 20 letters, digits or underscores, starting with a letter; unique ignoring case; no staff-sounding names. */
export function checkUsername(raw: unknown): UsernameCheck {
  const u = typeof raw === "string" ? raw.trim() : "";
  if (u.length < USERNAME_MIN || u.length > USERNAME_MAX) return { ok: false, error: `Pick a name of ${USERNAME_MIN} to ${USERNAME_MAX} characters.` };
  if (!USERNAME_RE.test(u)) return { ok: false, error: "Use letters, digits and underscores only, starting with a letter." };
  const lower = u.toLowerCase();
  if (RESERVED.has(lower) || /camcompare|admin|moderat/.test(lower)) return { ok: false, error: "That name is reserved. Please pick another." };
  return { ok: true, username: u, lower };
}

/** A path inside /u/ for a username (already validated, so no escaping surprises). */
export const userPath = (username: string) => `/u/${encodeURIComponent(username)}`;
export const threadPath = (id: string) => `/community/t/${id}`;

// ---------------------------------------------------------------- text

/**
 * Plain text from whatever someone typed: HTML tags and comments removed,
 * control characters and bidi overrides (which can disguise a link) dropped,
 * line endings normalised, trailing spaces trimmed, and at most one blank
 * line in a row. Pages render the result as text nodes, never as HTML.
 */
export function sanitizeText(input: unknown): string {
  if (typeof input !== "string") return "";
  let s = input.normalize("NFC").replace(/\r\n?/g, "\n");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  // Elements whose content is code, not prose: drop them whole.
  s = s.replace(/<(script|style|iframe|object|embed|template)\b[\s\S]*?<\/\1\s*>/gi, "");
  s = s.replace(/<\/?[a-zA-Z][^<>]*>/g, "");
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  s = s.replace(/[‪-‮⁦-⁩​﻿]/g, "");
  s = s
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n");
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/** One line (a title): sanitised, every run of whitespace a single space. */
export const sanitizeLine = (input: unknown) => sanitizeText(input).replace(/\s+/g, " ");

export type Segment = { type: "text"; text: string } | { type: "link"; text: string; href: string };

const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const LINK_TEXT_MAX = 60;

/** Trailing punctuation that belongs to the sentence, not the URL (a ")" only when unbalanced). */
function trimUrl(u: string): string {
  let s = u;
  for (;;) {
    const last = s.at(-1);
    if (last && ".,!?;:'\"]".includes(last)) s = s.slice(0, -1);
    else if (last === ")" && (s.match(/\(/g)?.length ?? 0) < (s.match(/\)/g)?.length ?? 0)) s = s.slice(0, -1);
    else return s;
  }
}

/**
 * Text split into plain runs and http(s) links, for rendering with
 * rel="nofollow ugc noopener". Nothing but http and https ever becomes a link.
 */
export function linkSegments(text: string): Segment[] {
  const out: Segment[] = [];
  let at = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    const raw = trimUrl(m[0]);
    let href: string | null = null;
    try {
      const u = new URL(raw);
      if ((u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".")) href = u.toString();
    } catch {
      href = null;
    }
    if (!href) continue;
    if (start > at) out.push({ type: "text", text: text.slice(at, start) });
    out.push({ type: "link", href, text: raw.length > LINK_TEXT_MAX ? `${raw.slice(0, LINK_TEXT_MAX - 1)}…` : raw });
    at = start + raw.length;
  }
  if (at < text.length) out.push({ type: "text", text: text.slice(at) });
  return out;
}

// ---------------------------------------------------------------- shapes the API returns

export type Author = { username: string; karma: number; expert: boolean };

export type CommentItem = {
  id: string;
  createdAt: string;
  editedAt: string | null;
  parentId: string | null;
  /** Empty when deleted. */
  body: string;
  deleted: boolean;
  /** Null when deleted. */
  author: Author | null;
  score: number;
  replies?: CommentItem[];
};

export type ReviewItem = { id: string; createdAt: string; editedAt: string | null; rating: number; body: string; author: Author; score: number };
export type ReviewSummary = { count: number; average: number | null; histogram: [number, number, number, number, number] };

export type ThreadItem = { id: string; createdAt: string; editedAt: string | null; board: BoardSlug; title: string; body: string; author: Author | null; score: number; replies: number; deleted: boolean };

export type Me = { username: string | null; karma: number; expert: boolean; createdAt: string };

/** A relative time for a post ("3 h ago"); falls back to the date. */
export function ago(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 30 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return new Date(t).toISOString().slice(0, 10);
}
