// Storage for member stories, the request board and My gear, in the same
// community tables (DDL in lib/community/db.ts). Same rules as the rest of
// the community: public reads leave out hidden and deleted posts and
// everything by banned members, scores are summed from the votes, and no
// public read returns an email or user id. The gear list is private: only
// its owner's signed-in requests read or write it.
import { product } from "../catalog";
import { authorsFor, q, SCORE } from "./db";
import type { GearItem } from "../collection";
import { PAGE_SIZE, type Author, type Sort } from "./rules";
import { isRequestStatus, type RequestItem, type RequestKind, type RequestStatus } from "./requests";
import { isStoryTag, readMinutes, storyExcerpt, type StoryItem, type StoryListItem, type StoryTag } from "./stories";

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
const n = (v: unknown) => Number(v ?? 0);
const offset = (page: number) => Math.max(0, page - 1) * PAGE_SIZE;
const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

// ---------------------------------------------------------------- stories

const COMMENTS = (target: string, idExpr: string) =>
  `(SELECT count(*) FROM community_comments c JOIN community_users cu ON cu.id = c.user_id AND NOT cu.banned WHERE c.target = '${target}:' || ${idExpr} AND NOT c.hidden AND NOT c.deleted)::int`;

const POST_COLS = `p.id::text AS id, p.created_at, p.edited_at, p.title, p.body, p.verdict, p.cover_url, p.tags, p.products, p.featured, p.deleted,
  u.id::text AS uid, u.username, u.created_at AS ucreated, ${SCORE("post", "p.id::text")} AS score, ${COMMENTS("post", "p.id::text")} AS comments`;
const POST_FROM = "FROM community_posts p JOIN community_users u ON u.id = p.user_id AND NOT u.banned";

function toListItem(r: Record<string, unknown>, authors: Map<string, Author>): StoryListItem {
  const body = String(r.body ?? "");
  const featured = Boolean(r.featured);
  return {
    id: String(r.id),
    createdAt: iso(r.created_at) ?? "",
    editedAt: iso(r.edited_at),
    title: String(r.title ?? ""),
    excerpt: storyExcerpt(body),
    tags: arr(r.tags).filter(isStoryTag) as StoryTag[],
    products: arr(r.products),
    featured,
    // A remote picture can change after the owner looks, so only stories the owner featured show one.
    cover: featured ? ((r.cover_url as string | null) ?? null) : null,
    author: authors.get(String(r.uid)) ?? null,
    score: n(r.score),
    comments: n(r.comments),
    minutes: readMinutes(body),
  };
}

/** Stories a page at a time: featured first, then by score or date; optionally one tag, or one product's. */
export async function listStories(opts: { sort: Sort; page: number; tag?: StoryTag | null; product?: string | null; limit?: number }): Promise<{ items: StoryListItem[]; hasMore: boolean }> {
  const limit = opts.limit ?? PAGE_SIZE;
  const order = opts.sort === "top" ? "p.featured DESC, score DESC, p.id DESC" : "p.featured DESC, p.id DESC";
  const rows = await q(
    `SELECT ${POST_COLS} ${POST_FROM} WHERE NOT p.hidden AND NOT p.deleted AND ($1::text IS NULL OR $1 = ANY(p.tags)) AND ($2::text IS NULL OR p.products @> ARRAY[$2::text])
     ORDER BY ${order} LIMIT $3 OFFSET $4`,
    [opts.tag ?? null, opts.product ?? null, limit + 1, Math.max(0, opts.page - 1) * limit],
  );
  const shown = rows.slice(0, limit);
  const authors = await authorsFor(shown);
  return { items: shown.map((r) => toListItem(r, authors)), hasMore: rows.length > limit };
}

/** One visible story (a deleted one comes back as "[deleted]" so its comments keep a home). */
export async function getStory(id: string): Promise<StoryItem | null> {
  const [r] = await q(`SELECT ${POST_COLS} ${POST_FROM} WHERE p.id = $1::bigint AND NOT p.hidden`, [id]);
  if (!r) return null;
  const authors = await authorsFor([r]);
  const deleted = Boolean(r.deleted);
  const item = toListItem(r, authors);
  if (deleted) return { ...item, title: "[deleted]", excerpt: "", body: "", verdict: null, cover: null, author: null, deleted, products: [], tags: [] };
  return { ...item, body: String(r.body ?? ""), verdict: (r.verdict as string | null) || null, deleted };
}

/** A story people can see (`open`: and still takes comments). */
export async function storyVisible(id: string, open = true): Promise<boolean> {
  return (await q(`SELECT 1 FROM community_posts p JOIN community_users u ON u.id = p.user_id AND NOT u.banned WHERE p.id = $1::bigint AND NOT p.hidden ${open ? "AND NOT p.deleted" : ""}`, [id])).length > 0;
}

/** The author's own story for the editor, cover included (it isn't public until featured). */
export async function myStory(id: string, userId: string): Promise<{ title: string; body: string; verdict: string | null; cover: string | null; tags: string[]; products: string[] } | null> {
  const [r] = await q("SELECT title, body, verdict, cover_url, tags, products FROM community_posts WHERE id = $1::bigint AND user_id = $2::bigint AND NOT deleted", [id, userId]);
  return r ? { title: String(r.title), body: String(r.body), verdict: (r.verdict as string | null) ?? null, cover: (r.cover_url as string | null) ?? null, tags: arr(r.tags), products: arr(r.products) } : null;
}

/** Every slug a story names must be a published product; otherwise the first one that isn't. */
export function knownProducts(slugs: string[]): { ok: true } | { ok: false; slug: string } {
  for (const s of slugs) if (!product(s)) return { ok: false, slug: s };
  return { ok: true };
}

export type StoryWrite = { title: string; body: string; verdict: string | null; cover: string | null; tags: string[]; products: string[] };

export async function createStory(userId: string, s: StoryWrite): Promise<string> {
  const [r] = await q("INSERT INTO community_posts (user_id, title, body, verdict, cover_url, tags, products) VALUES ($1::bigint, $2, $3, $4, $5, $6::text[], $7::text[]) RETURNING id::text AS id", [
    userId,
    s.title,
    s.body,
    s.verdict,
    s.cover,
    s.tags,
    s.products,
  ]);
  return String(r.id);
}

/**
 * An author's edit. A featured story that changes leaves the featured list
 * (and the index) until the owner looks again: featuring vouches for the
 * text the owner read, not whatever it becomes.
 */
export async function editStory(id: string, userId: string, s: StoryWrite): Promise<boolean> {
  return (
    await q(
      "UPDATE community_posts SET title = $3, body = $4, verdict = $5, cover_url = $6, tags = $7::text[], products = $8::text[], edited_at = now(), featured = false WHERE id = $1::bigint AND user_id = $2::bigint AND NOT deleted RETURNING id",
      [id, userId, s.title, s.body, s.verdict, s.cover, s.tags, s.products],
    )
  ).length > 0;
}

export async function deleteStory(id: string, userId: string): Promise<boolean> {
  return (await q("UPDATE community_posts SET body = '', verdict = NULL, cover_url = NULL, deleted = true, featured = false, edited_at = now() WHERE id = $1::bigint AND user_id = $2::bigint AND NOT deleted RETURNING id", [id, userId])).length > 0;
}

export async function storiesToday(userId: string): Promise<number> {
  const [r] = await q("SELECT count(*)::int AS n FROM community_posts WHERE user_id = $1::bigint AND created_at > now() - interval '1 day'", [userId]);
  return n(r?.n);
}

/** The owner's switch: a featured story is listed first and indexable. */
export async function setFeatured(id: string, featured: boolean): Promise<boolean> {
  return (await q("UPDATE community_posts SET featured = $2, featured_at = CASE WHEN $2 THEN now() ELSE NULL END WHERE id = $1::bigint AND NOT deleted RETURNING id", [id, featured])).length > 0;
}

export type AdminStory = { id: string; createdAt: string; title: string; author: string | null; authorBanned: boolean; hidden: boolean; featured: boolean; score: number; cover: string | null; products: string[] };

/** Every story but deleted ones, newest first, for the owner's feature buttons. */
export async function adminStories(limit = 40): Promise<AdminStory[]> {
  const rows = await q(
    `SELECT p.id::text AS id, p.created_at, p.title, p.hidden, p.featured, p.cover_url, p.products, u.username, u.banned, ${SCORE("post", "p.id::text")} AS score
     FROM community_posts p JOIN community_users u ON u.id = p.user_id WHERE NOT p.deleted ORDER BY p.featured DESC, p.id DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: String(r.id),
    createdAt: iso(r.created_at) ?? "",
    title: String(r.title),
    author: (r.username as string | null) ?? null,
    authorBanned: Boolean(r.banned),
    hidden: Boolean(r.hidden),
    featured: Boolean(r.featured),
    score: n(r.score),
    cover: (r.cover_url as string | null) ?? null,
    products: arr(r.products),
  }));
}

// ---------------------------------------------------------------- requests

const REQ_COLS = `r.id::text AS id, r.created_at, r.edited_at, r.kind, r.title, r.body, r.status, r.status_note, r.status_at,
  u.id::text AS uid, u.username, u.created_at AS ucreated, ${SCORE("request", "r.id::text")} AS score, ${COMMENTS("request", "r.id::text")} AS comments`;
const REQ_FROM = "FROM community_requests r JOIN community_users u ON u.id = r.user_id AND NOT u.banned";

function toRequest(r: Record<string, unknown>, authors: Map<string, Author>): RequestItem {
  const status = String(r.status);
  return {
    id: String(r.id),
    createdAt: iso(r.created_at) ?? "",
    editedAt: iso(r.edited_at),
    kind: String(r.kind) as RequestKind,
    title: String(r.title ?? ""),
    body: String(r.body ?? ""),
    status: isRequestStatus(status) ? status : "open",
    statusNote: (r.status_note as string | null) || null,
    statusAt: iso(r.status_at),
    author: authors.get(String(r.uid)) ?? null,
    score: n(r.score),
    comments: n(r.comments),
  };
}

export async function listRequests(opts: { sort: Sort; page: number; status?: RequestStatus | null }): Promise<{ items: RequestItem[]; hasMore: boolean }> {
  const order = opts.sort === "top" ? "score DESC, r.id DESC" : "r.id DESC";
  const rows = await q(`SELECT ${REQ_COLS} ${REQ_FROM} WHERE NOT r.hidden AND NOT r.deleted AND ($1::text IS NULL OR r.status = $1) ORDER BY ${order} LIMIT $2 OFFSET $3`, [
    opts.status ?? null,
    PAGE_SIZE + 1,
    offset(opts.page),
  ]);
  const shown = rows.slice(0, PAGE_SIZE);
  const authors = await authorsFor(shown);
  return { items: shown.map((r) => toRequest(r, authors)), hasMore: rows.length > PAGE_SIZE };
}

export async function requestVisible(id: string, open = true): Promise<boolean> {
  return (await q(`SELECT 1 FROM community_requests r JOIN community_users u ON u.id = r.user_id AND NOT u.banned WHERE r.id = $1::bigint AND NOT r.hidden ${open ? "AND NOT r.deleted" : ""}`, [id])).length > 0;
}

export async function createRequest(userId: string, kind: RequestKind, title: string, body: string): Promise<string> {
  const [r] = await q("INSERT INTO community_requests (user_id, kind, title, body) VALUES ($1::bigint, $2, $3, $4) RETURNING id::text AS id", [userId, kind, title, body]);
  return String(r.id);
}

export async function deleteRequest(id: string, userId: string): Promise<boolean> {
  return (await q("UPDATE community_requests SET deleted = true, edited_at = now() WHERE id = $1::bigint AND user_id = $2::bigint AND NOT deleted RETURNING id", [id, userId])).length > 0;
}

export async function requestsToday(userId: string): Promise<number> {
  const [r] = await q("SELECT count(*)::int AS n FROM community_requests WHERE user_id = $1::bigint AND created_at > now() - interval '1 day'", [userId]);
  return n(r?.n);
}

export async function setRequestStatus(id: string, status: RequestStatus, note: string | null): Promise<boolean> {
  return (await q("UPDATE community_requests SET status = $2, status_note = $3, status_at = now() WHERE id = $1::bigint RETURNING id", [id, status, note])).length > 0;
}

export type AdminRequest = { id: string; createdAt: string; kind: string; title: string; body: string; status: RequestStatus; statusNote: string | null; author: string | null; hidden: boolean; score: number };

/** Open and planned requests by score, then the rest, for the owner's status buttons. */
export async function adminRequests(limit = 60): Promise<AdminRequest[]> {
  const rows = await q(
    `SELECT r.id::text AS id, r.created_at, r.kind, r.title, left(r.body, 300) AS body, r.status, r.status_note, r.hidden, u.username, ${SCORE("request", "r.id::text")} AS score
     FROM community_requests r JOIN community_users u ON u.id = r.user_id WHERE NOT r.deleted
     ORDER BY (r.status IN ('open', 'planned')) DESC, score DESC, r.id DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => {
    const status = String(r.status);
    return {
      id: String(r.id),
      createdAt: iso(r.created_at) ?? "",
      kind: String(r.kind),
      title: String(r.title),
      body: String(r.body ?? ""),
      status: isRequestStatus(status) ? status : "open",
      statusNote: (r.status_note as string | null) ?? null,
      author: (r.username as string | null) ?? null,
      hidden: Boolean(r.hidden),
      score: n(r.score),
    };
  });
}

// ---------------------------------------------------------------- My gear (private)

export async function readCollection(userId: string): Promise<{ items: unknown; updatedAt: string | null }> {
  const [r] = await q("SELECT items, updated_at FROM community_collection WHERE user_id = $1::bigint", [userId]);
  return r ? { items: r.items, updatedAt: iso(r.updated_at) } : { items: [], updatedAt: null };
}

export async function writeCollection(userId: string, items: GearItem[]): Promise<void> {
  await q(
    "INSERT INTO community_collection (user_id, items, updated_at) VALUES ($1::bigint, $2::jsonb, now()) ON CONFLICT (user_id) DO UPDATE SET items = EXCLUDED.items, updated_at = now()",
    [userId, JSON.stringify(items)],
  );
}
