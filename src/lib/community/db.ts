// Community storage: tables in the same small Neon project as feedback and
// price alerts (DATABASE_URL), created on first use like theirs
// (lib/feedback.ts, lib/alerts.ts). Unlike them this is public,
// user-generated content, read at request time by client fetches through
// /api/community/* GETs that the CDN caches for 30 s (DECISIONS.md,
// 2026-10-17 "Community v1"). No page reads it at build time.
//
// Never returned by a public query: email, user ids, session and token rows.
// Scores are always computed from the votes (never a stored counter, so a
// retried request can't skew one), counting only members who aren't banned.
// Hidden posts, and every post by a banned member, are left out of every
// public read; a deleted comment shows as "[deleted]" only while it has replies.
import { neon } from "@neondatabase/serverless";
import { isCamExpert, PAGE_SIZE, type Author, type BoardSlug, type CommentItem, type ReviewItem, type ReviewSummary, type Sort, type ThreadItem, type VoteKind, type VoteValue } from "./rules";

export const communityConfigured = () => Boolean(process.env.DATABASE_URL?.trim());
export const COMMUNITY_NOT_CONNECTED = "The community isn't connected yet. Please check back soon.";

type Sql = ReturnType<typeof neon>;
let sql: Sql | null = null;
let sqlUrl = "";
let ready: Promise<void> | null = null;

function db(): Sql {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!sql || url !== sqlUrl) {
    sql = neon(url, { fetchOptions: { cache: "no-store" } });
    sqlUrl = url;
    ready = null;
  }
  return sql;
}

const opts = () => ({ fetchOptions: { cache: "no-store" as const, signal: AbortSignal.timeout(9000) } });

// The last table here is the sentinel: when it exists, every table before it
// does, and an instance skips the DDL with one query. A later schema change
// adds its statements after it and moves the sentinel.
const DDL = [
  `CREATE TABLE IF NOT EXISTS community_users (
    id bigserial primary key,
    created_at timestamptz not null default now(),
    email text not null unique,
    username text,
    username_lower text unique,
    banned boolean not null default false,
    last_seen_at timestamptz
  )`,
  `CREATE TABLE IF NOT EXISTS community_login_tokens (
    id bigserial primary key,
    created_at timestamptz not null default now(),
    token_hash text not null unique,
    email text not null,
    ip_key text,
    next_path text,
    expires_at timestamptz not null,
    used_at timestamptz
  )`,
  "CREATE INDEX IF NOT EXISTS community_login_tokens_email ON community_login_tokens (email, created_at)",
  "CREATE INDEX IF NOT EXISTS community_login_tokens_ip ON community_login_tokens (ip_key, created_at)",
  `CREATE TABLE IF NOT EXISTS community_sessions (
    id bigserial primary key,
    created_at timestamptz not null default now(),
    token_hash text not null unique,
    user_id bigint not null references community_users(id) on delete cascade,
    expires_at timestamptz not null
  )`,
  `CREATE TABLE IF NOT EXISTS community_threads (
    id bigserial primary key,
    created_at timestamptz not null default now(),
    user_id bigint not null references community_users(id),
    board text not null,
    title text not null,
    body text not null default '',
    edited_at timestamptz,
    deleted boolean not null default false,
    hidden boolean not null default false
  )`,
  "CREATE INDEX IF NOT EXISTS community_threads_board ON community_threads (board, id)",
  `CREATE TABLE IF NOT EXISTS community_comments (
    id bigserial primary key,
    created_at timestamptz not null default now(),
    user_id bigint not null references community_users(id),
    target text not null,
    parent_id bigint references community_comments(id),
    body text not null,
    edited_at timestamptz,
    deleted boolean not null default false,
    hidden boolean not null default false
  )`,
  "CREATE INDEX IF NOT EXISTS community_comments_target ON community_comments (target, id)",
  "CREATE INDEX IF NOT EXISTS community_comments_parent ON community_comments (parent_id)",
  "CREATE INDEX IF NOT EXISTS community_comments_user ON community_comments (user_id, id)",
  `CREATE TABLE IF NOT EXISTS community_reviews (
    id bigserial primary key,
    created_at timestamptz not null default now(),
    user_id bigint not null references community_users(id),
    product text not null,
    rating smallint not null check (rating between 1 and 5),
    body text not null,
    edited_at timestamptz,
    hidden boolean not null default false,
    unique (product, user_id)
  )`,
  "CREATE INDEX IF NOT EXISTS community_reviews_user ON community_reviews (user_id, id)",
  `CREATE TABLE IF NOT EXISTS community_votes (
    user_id bigint not null references community_users(id),
    kind text not null,
    target text not null,
    value smallint not null check (value in (-1, 1)),
    created_at timestamptz not null default now(),
    primary key (user_id, kind, target)
  )`,
  "CREATE INDEX IF NOT EXISTS community_votes_target ON community_votes (kind, target)",
  `CREATE TABLE IF NOT EXISTS community_reports (
    id bigserial primary key,
    created_at timestamptz not null default now(),
    user_id bigint not null references community_users(id),
    kind text not null,
    target_id text not null,
    reason text not null,
    note text,
    resolved boolean not null default false,
    unique (user_id, kind, target_id)
  )`,
  `CREATE TABLE IF NOT EXISTS community_notices (
    day date not null,
    kind text not null,
    n integer not null default 0,
    primary key (day, kind)
  )`,
];
const SENTINEL = "community_notices";

function ensureTables(s: Sql): Promise<void> {
  ready ??= (async () => {
    const [r] = (await s.query("SELECT to_regclass($1) IS NOT NULL AS ok", [`public.${SENTINEL}`], opts())) as { ok: boolean }[];
    if (r?.ok) return;
    for (const q of DDL) {
      try {
        await s.query(q, [], opts());
      } catch (e) {
        const code = (e as { code?: string })?.code;
        if (code === "42P07" || code === "23505") continue; // another instance made it first
        throw e;
      }
    }
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

async function q(text: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  const s = db();
  await ensureTables(s);
  return (await s.query(text, params, opts())) as Record<string, unknown>[];
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
const n = (v: unknown) => Number(v ?? 0);

// A vote counts only while its member isn't banned. `kind` is one of our own
// constants, never input, so it is safe inline.
const SCORE = (kind: VoteKind, idExpr: string) =>
  `COALESCE((SELECT SUM(v.value) FROM community_votes v JOIN community_users vu ON vu.id = v.user_id AND NOT vu.banned WHERE v.kind = '${kind}' AND v.target = ${idExpr}), 0)::int`;

// ---------------------------------------------------------------- users and sessions

export type User = { id: string; username: string | null; createdAt: string; banned: boolean };
const toUser = (r: Record<string, unknown>): User => ({ id: String(r.id), username: (r.username as string | null) ?? null, createdAt: iso(r.created_at) ?? "", banned: Boolean(r.banned) });

/** How many sign-in links went to this address in the window, and from this IP in the last hour. */
export async function loginRequestCounts(email: string, ip: string, windowMs: number): Promise<{ byEmail: number; byIp: number }> {
  const [r] = await q(
    "SELECT count(*) FILTER (WHERE email = $1 AND created_at > now() - ($3::int * interval '1 millisecond'))::int AS e, count(*) FILTER (WHERE ip_key = $2 AND created_at > now() - interval '1 hour')::int AS i FROM community_login_tokens WHERE (email = $1 OR ip_key = $2) AND created_at > now() - interval '1 hour'",
    [email, ip, windowMs],
  );
  return { byEmail: n(r?.e), byIp: n(r?.i) };
}

export async function createLoginToken(t: { tokenHash: string; email: string; ipKey: string; next: string | null; expiresAt: Date }): Promise<void> {
  // Old links are no use to anyone: drop them as new ones are made.
  await q("DELETE FROM community_login_tokens WHERE created_at < now() - interval '2 days'");
  await q("INSERT INTO community_login_tokens (token_hash, email, ip_key, next_path, expires_at) VALUES ($1, $2, $3, $4, $5)", [t.tokenHash, t.email, t.ipKey, t.next, t.expiresAt.toISOString()]);
}

/** Uses a link token up, atomically: a second click (or a race) gets null. */
export async function consumeLoginToken(tokenHash: string): Promise<{ email: string; next: string | null } | null> {
  const [r] = await q("UPDATE community_login_tokens SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING email, next_path", [tokenHash]);
  return r ? { email: String(r.email), next: (r.next_path as string | null) ?? null } : null;
}

export async function upsertUserByEmail(email: string): Promise<User> {
  const [r] = await q("INSERT INTO community_users (email, last_seen_at) VALUES ($1, now()) ON CONFLICT (email) DO UPDATE SET last_seen_at = now() RETURNING id::text AS id, username, created_at, banned", [email]);
  return toUser(r);
}

export async function createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
  await q("DELETE FROM community_sessions WHERE user_id = $1::bigint AND expires_at < now()", [userId]);
  await q("INSERT INTO community_sessions (token_hash, user_id, expires_at) VALUES ($1, $2::bigint, $3)", [tokenHash, userId, expiresAt.toISOString()]);
}

export async function deleteSession(tokenHash: string): Promise<void> {
  await q("DELETE FROM community_sessions WHERE token_hash = $1", [tokenHash]);
}

export async function sessionUser(tokenHash: string): Promise<User | null> {
  const [r] = await q(
    "SELECT u.id::text AS id, u.username, u.created_at, u.banned FROM community_sessions s JOIN community_users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()",
    [tokenHash],
  );
  return r ? toUser(r) : null;
}

/** Sets a first username. "taken" when someone has it in any case; "already" when this member has one. */
export async function setUsername(userId: string, username: string, lower: string): Promise<"ok" | "taken" | "already"> {
  try {
    const rows = await q("UPDATE community_users SET username = $2, username_lower = $3 WHERE id = $1::bigint AND username IS NULL RETURNING id", [userId, username, lower]);
    return rows.length ? "ok" : "already";
  } catch (e) {
    if ((e as { code?: string })?.code === "23505") return "taken";
    throw e;
  }
}

// ---------------------------------------------------------------- karma

/** CamKarma per member: votes from members who aren't banned on their visible comments and reviews. */
export async function karmaFor(userIds: string[]): Promise<Map<string, { karma: number; createdAt: string }>> {
  const out = new Map<string, { karma: number; createdAt: string }>();
  if (!userIds.length) return out;
  const rows = await q(
    `SELECT u.id::text AS id, u.created_at,
       COALESCE((SELECT SUM(v.value) FROM community_comments c JOIN community_votes v ON v.kind = 'comment' AND v.target = c.id::text JOIN community_users vu ON vu.id = v.user_id AND NOT vu.banned
                 WHERE c.user_id = u.id AND NOT c.hidden AND NOT c.deleted), 0)::int
     + COALESCE((SELECT SUM(v.value) FROM community_reviews r JOIN community_votes v ON v.kind = 'review' AND v.target = r.id::text JOIN community_users vu ON vu.id = v.user_id AND NOT vu.banned
                 WHERE r.user_id = u.id AND NOT r.hidden), 0)::int AS karma
     FROM community_users u WHERE u.id = ANY($1::bigint[])`,
    [userIds],
  );
  for (const r of rows) out.set(String(r.id), { karma: n(r.karma), createdAt: iso(r.created_at) ?? "" });
  return out;
}

async function authorsFor(rows: Record<string, unknown>[]): Promise<Map<string, Author>> {
  const ids = [...new Set(rows.filter((r) => r.uid != null).map((r) => String(r.uid)))];
  const k = await karmaFor(ids);
  const out = new Map<string, Author>();
  for (const r of rows) {
    if (r.uid == null) continue;
    const id = String(r.uid);
    const kk = k.get(id) ?? { karma: 0, createdAt: iso(r.ucreated) ?? "" };
    out.set(id, { username: String(r.username ?? "member"), karma: kk.karma, expert: isCamExpert(kk.karma, kk.createdAt) });
  }
  return out;
}

// ---------------------------------------------------------------- comments

const COMMENT_COLS = `c.id::text AS id, c.created_at, c.edited_at, c.parent_id::text AS parent_id, c.body, c.deleted, u.id::text AS uid, u.username, u.created_at AS ucreated, ${SCORE("comment", "c.id::text")} AS score`;
const COMMENT_FROM = "FROM community_comments c JOIN community_users u ON u.id = c.user_id AND NOT u.banned";

function toComment(r: Record<string, unknown>, authors: Map<string, Author>): CommentItem {
  const deleted = Boolean(r.deleted);
  return {
    id: String(r.id),
    createdAt: iso(r.created_at) ?? "",
    editedAt: iso(r.edited_at),
    parentId: (r.parent_id as string | null) ?? null,
    body: deleted ? "" : String(r.body ?? ""),
    deleted,
    author: deleted ? null : authors.get(String(r.uid)) ?? null,
    score: n(r.score),
  };
}

const offset = (page: number) => Math.max(0, page - 1) * PAGE_SIZE;

/** Top-level comments for a target, a page at a time, each with its (visible) replies oldest first. */
export async function listComments(target: string, sort: Sort, page: number): Promise<{ items: CommentItem[]; hasMore: boolean; total: number }> {
  const order = sort === "top" ? "score DESC, c.id DESC" : "c.id DESC";
  const [top, [count]] = await Promise.all([
    q(`SELECT ${COMMENT_COLS} ${COMMENT_FROM} WHERE c.target = $1 AND c.parent_id IS NULL AND NOT c.hidden ORDER BY ${order} LIMIT $2 OFFSET $3`, [target, PAGE_SIZE + 1, offset(page)]),
    q(`SELECT count(*)::int AS n ${COMMENT_FROM} WHERE c.target = $1 AND NOT c.hidden AND NOT c.deleted`, [target]),
  ]);
  const hasMore = top.length > PAGE_SIZE;
  const parents = top.slice(0, PAGE_SIZE);
  const replies = parents.length
    ? await q(`SELECT ${COMMENT_COLS} ${COMMENT_FROM} WHERE c.parent_id = ANY($1::bigint[]) AND NOT c.hidden AND NOT c.deleted ORDER BY c.id ASC LIMIT 500`, [parents.map((r) => r.id)])
    : [];
  const authors = await authorsFor([...parents, ...replies]);
  const byParent = new Map<string, CommentItem[]>();
  for (const r of replies) {
    const c = toComment(r, authors);
    if (!c.parentId) continue;
    byParent.set(c.parentId, [...(byParent.get(c.parentId) ?? []), c]);
  }
  const items = parents
    .map((r) => ({ ...toComment(r, authors), replies: byParent.get(String(r.id)) ?? [] }))
    .filter((c) => !c.deleted || c.replies.length > 0);
  return { items, hasMore, total: n(count?.n) };
}

export type CommentRef = { id: string; userId: string; target: string; parentId: string | null; deleted: boolean; hidden: boolean };
export async function getComment(id: string): Promise<CommentRef | null> {
  const [r] = await q("SELECT id::text AS id, user_id::text AS user_id, target, parent_id::text AS parent_id, deleted, hidden FROM community_comments WHERE id = $1::bigint", [id]);
  return r ? { id: String(r.id), userId: String(r.user_id), target: String(r.target), parentId: (r.parent_id as string | null) ?? null, deleted: Boolean(r.deleted), hidden: Boolean(r.hidden) } : null;
}

export async function createComment(userId: string, target: string, parentId: string | null, body: string): Promise<string> {
  const [r] = await q("INSERT INTO community_comments (user_id, target, parent_id, body) VALUES ($1::bigint, $2, $3::bigint, $4) RETURNING id::text AS id", [userId, target, parentId, body]);
  return String(r.id);
}

export async function editComment(id: string, userId: string, body: string): Promise<boolean> {
  return (await q("UPDATE community_comments SET body = $3, edited_at = now() WHERE id = $1::bigint AND user_id = $2::bigint AND NOT deleted RETURNING id", [id, userId, body])).length > 0;
}

/** Soft delete: the text goes, the row stays so replies keep their place. */
export async function deleteComment(id: string, userId: string): Promise<boolean> {
  return (await q("UPDATE community_comments SET body = '', deleted = true, edited_at = now() WHERE id = $1::bigint AND user_id = $2::bigint AND NOT deleted RETURNING id", [id, userId])).length > 0;
}

// ---------------------------------------------------------------- threads

const THREAD_COLS = `t.id::text AS id, t.created_at, t.edited_at, t.board, t.title, t.body, t.deleted, u.id::text AS uid, u.username, u.created_at AS ucreated, ${SCORE("thread", "t.id::text")} AS score,
  (SELECT count(*) FROM community_comments c JOIN community_users cu ON cu.id = c.user_id AND NOT cu.banned WHERE c.target = 'thread:' || t.id::text AND NOT c.hidden AND NOT c.deleted)::int AS replies`;
const THREAD_FROM = "FROM community_threads t JOIN community_users u ON u.id = t.user_id AND NOT u.banned";

function toThread(r: Record<string, unknown>, authors: Map<string, Author>, excerpt = false): ThreadItem {
  const deleted = Boolean(r.deleted);
  const body = deleted ? "" : String(r.body ?? "");
  return {
    id: String(r.id),
    createdAt: iso(r.created_at) ?? "",
    editedAt: iso(r.edited_at),
    board: String(r.board) as BoardSlug,
    title: deleted ? "[deleted]" : String(r.title ?? ""),
    body: excerpt && body.length > 280 ? `${body.slice(0, 279)}…` : body,
    author: deleted ? null : authors.get(String(r.uid)) ?? null,
    score: n(r.score),
    replies: n(r.replies),
    deleted,
  };
}

export async function listThreads(board: BoardSlug | null, sort: Sort, page: number): Promise<{ items: ThreadItem[]; hasMore: boolean }> {
  const order = sort === "top" ? "score DESC, t.id DESC" : "t.id DESC";
  const rows = await q(`SELECT ${THREAD_COLS} ${THREAD_FROM} WHERE NOT t.hidden AND NOT t.deleted AND ($1::text IS NULL OR t.board = $1) ORDER BY ${order} LIMIT $2 OFFSET $3`, [board, PAGE_SIZE + 1, offset(page)]);
  const shown = rows.slice(0, PAGE_SIZE);
  const authors = await authorsFor(shown);
  return { items: shown.map((r) => toThread(r, authors, true)), hasMore: rows.length > PAGE_SIZE };
}

/** One visible thread (a deleted one shows as "[deleted]" so its replies still have a home). */
export async function getThread(id: string): Promise<ThreadItem | null> {
  const [r] = await q(`SELECT ${THREAD_COLS} ${THREAD_FROM} WHERE t.id = $1::bigint AND NOT t.hidden`, [id]);
  if (!r) return null;
  return toThread(r, await authorsFor([r]));
}

/** A thread people can see (`open`: and still take comments, i.e. not deleted). */
export async function threadVisible(id: string, open = true): Promise<boolean> {
  return (await q(`SELECT 1 FROM community_threads t JOIN community_users u ON u.id = t.user_id AND NOT u.banned WHERE t.id = $1::bigint AND NOT t.hidden ${open ? "AND NOT t.deleted" : ""}`, [id])).length > 0;
}

export async function createThread(userId: string, board: BoardSlug, title: string, body: string): Promise<string> {
  const [r] = await q("INSERT INTO community_threads (user_id, board, title, body) VALUES ($1::bigint, $2, $3, $4) RETURNING id::text AS id", [userId, board, title, body]);
  return String(r.id);
}

export async function editThread(id: string, userId: string, title: string, body: string): Promise<boolean> {
  return (await q("UPDATE community_threads SET title = $3, body = $4, edited_at = now() WHERE id = $1::bigint AND user_id = $2::bigint AND NOT deleted RETURNING id", [id, userId, title, body])).length > 0;
}

export async function deleteThread(id: string, userId: string): Promise<boolean> {
  return (await q("UPDATE community_threads SET body = '', deleted = true, edited_at = now() WHERE id = $1::bigint AND user_id = $2::bigint AND NOT deleted RETURNING id", [id, userId])).length > 0;
}

// ---------------------------------------------------------------- reviews

const REVIEW_COLS = `r.id::text AS id, r.created_at, r.edited_at, r.rating, r.body, u.id::text AS uid, u.username, u.created_at AS ucreated, ${SCORE("review", "r.id::text")} AS score`;
const REVIEW_FROM = "FROM community_reviews r JOIN community_users u ON u.id = r.user_id AND NOT u.banned";

export async function listReviews(product: string, sort: Sort, page: number): Promise<{ items: ReviewItem[]; hasMore: boolean; summary: ReviewSummary }> {
  const order = sort === "top" ? "score DESC, r.id DESC" : "r.id DESC";
  const [rows, hist] = await Promise.all([
    q(`SELECT ${REVIEW_COLS} ${REVIEW_FROM} WHERE r.product = $1 AND NOT r.hidden ORDER BY ${order} LIMIT $2 OFFSET $3`, [product, PAGE_SIZE + 1, offset(page)]),
    q(`SELECT r.rating, count(*)::int AS n ${REVIEW_FROM} WHERE r.product = $1 AND NOT r.hidden GROUP BY r.rating`, [product]),
  ]);
  const shown = rows.slice(0, PAGE_SIZE);
  const authors = await authorsFor(shown);
  const histogram: ReviewSummary["histogram"] = [0, 0, 0, 0, 0];
  for (const h of hist) {
    const star = n(h.rating);
    if (star >= 1 && star <= 5) histogram[star - 1] = n(h.n);
  }
  const count = histogram.reduce((a, b) => a + b, 0);
  const average = count ? Math.round((histogram.reduce((a, c, i) => a + c * (i + 1), 0) / count) * 10) / 10 : null;
  return {
    items: shown.map((r) => ({ id: String(r.id), createdAt: iso(r.created_at) ?? "", editedAt: iso(r.edited_at), rating: n(r.rating), body: String(r.body ?? ""), author: authors.get(String(r.uid))!, score: n(r.score) })).filter((r) => r.author),
    hasMore: rows.length > PAGE_SIZE,
    summary: { count, average, histogram },
  };
}

/** One review per member per product: a second one replaces the first. */
export async function upsertReview(userId: string, product: string, rating: number, body: string): Promise<{ id: string; created: boolean }> {
  const [r] = await q(
    `INSERT INTO community_reviews (user_id, product, rating, body) VALUES ($1::bigint, $2, $3, $4)
     ON CONFLICT (product, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body, edited_at = now()
     RETURNING id::text AS id, (xmax = 0) AS created`,
    [userId, product, rating, body],
  );
  return { id: String(r.id), created: Boolean(r.created) };
}

export async function myReview(userId: string, product: string): Promise<{ id: string; rating: number; body: string; hidden: boolean } | null> {
  const [r] = await q("SELECT id::text AS id, rating, body, hidden FROM community_reviews WHERE user_id = $1::bigint AND product = $2", [userId, product]);
  return r ? { id: String(r.id), rating: n(r.rating), body: String(r.body), hidden: Boolean(r.hidden) } : null;
}

export async function deleteReview(id: string, userId: string): Promise<boolean> {
  const rows = await q("DELETE FROM community_reviews WHERE id = $1::bigint AND user_id = $2::bigint RETURNING id", [id, userId]);
  if (rows.length) await q("DELETE FROM community_votes WHERE kind = 'review' AND target = $1", [id]);
  return rows.length > 0;
}

// ---------------------------------------------------------------- votes

/** The author of a visible comment, review or thread (to refuse self-votes), or null when there is none to vote on. */
export async function postAuthor(kind: "comment" | "review" | "thread", id: string): Promise<string | null> {
  const table = kind === "comment" ? "community_comments" : kind === "review" ? "community_reviews" : "community_threads";
  const deleted = kind === "review" ? "" : "AND NOT p.deleted";
  const [r] = await q(`SELECT p.user_id::text AS uid FROM ${table} p JOIN community_users u ON u.id = p.user_id AND NOT u.banned WHERE p.id = $1::bigint AND NOT p.hidden ${deleted}`, [id]);
  return r ? String(r.uid) : null;
}

/** Sets this member's vote on one target: 0 removes it. */
export async function setVote(userId: string, kind: VoteKind, target: string, value: VoteValue): Promise<void> {
  if (value === 0) await q("DELETE FROM community_votes WHERE user_id = $1::bigint AND kind = $2 AND target = $3", [userId, kind, target]);
  else
    await q("INSERT INTO community_votes (user_id, kind, target, value) VALUES ($1::bigint, $2, $3, $4) ON CONFLICT (user_id, kind, target) DO UPDATE SET value = EXCLUDED.value, created_at = now()", [
      userId,
      kind,
      target,
      value,
    ]);
}

export async function scoreOf(kind: VoteKind, target: string): Promise<number> {
  const [r] = await q(`SELECT ${SCORE(kind, "$1::text")} AS score`, [target]);
  return n(r?.score);
}

export async function myVotes(userId: string, kind: VoteKind, targets: string[]): Promise<Record<string, VoteValue>> {
  if (!targets.length) return {};
  const rows = await q("SELECT target, value FROM community_votes WHERE user_id = $1::bigint AND kind = $2 AND target = ANY($3::text[])", [userId, kind, targets]);
  return Object.fromEntries(rows.map((r) => [String(r.target), n(r.value) as VoteValue]));
}

/** Scores for many deal keys in one query; keys nobody voted on are 0. */
export async function dealScores(keys: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  if (!keys.length) return out;
  const rows = await q("SELECT v.target, SUM(v.value)::int AS score FROM community_votes v JOIN community_users u ON u.id = v.user_id AND NOT u.banned WHERE v.kind = 'deal' AND v.target = ANY($1::text[]) GROUP BY v.target", [keys]);
  for (const r of rows) out[String(r.target)] = n(r.score);
  return out;
}

// ---------------------------------------------------------------- rate limits across instances

/** Posts (comments, threads, reviews) this member made in the last `minutes`. */
export async function recentPosts(userId: string, minutes: number): Promise<number> {
  const [r] = await q(
    `SELECT (SELECT count(*) FROM community_comments WHERE user_id = $1::bigint AND created_at > now() - ($2::int * interval '1 minute'))
          + (SELECT count(*) FROM community_threads WHERE user_id = $1::bigint AND created_at > now() - ($2::int * interval '1 minute'))
          + (SELECT count(*) FROM community_reviews WHERE user_id = $1::bigint AND created_at > now() - ($2::int * interval '1 minute')) AS n`,
    [userId, minutes],
  );
  return n(r?.n);
}

// ---------------------------------------------------------------- reports and moderation

export type PostKind = "comment" | "review" | "thread";
const TABLE: Record<PostKind, string> = { comment: "community_comments", review: "community_reviews", thread: "community_threads" };

/** Saves one report (once per member per post) and says how many members have reported it. */
export async function addReport(userId: string, kind: PostKind, id: string, reason: string, note: string | null): Promise<{ inserted: boolean; reporters: number }> {
  const ins = await q("INSERT INTO community_reports (user_id, kind, target_id, reason, note) VALUES ($1::bigint, $2, $3, $4, $5) ON CONFLICT (user_id, kind, target_id) DO NOTHING RETURNING id", [userId, kind, id, reason, note]);
  const [r] = await q("SELECT count(*)::int AS n FROM community_reports WHERE kind = $1 AND target_id = $2 AND NOT resolved", [kind, id]);
  return { inserted: ins.length > 0, reporters: n(r?.n) };
}

export async function setHidden(kind: PostKind, id: string, hidden: boolean): Promise<boolean> {
  return (await q(`UPDATE ${TABLE[kind]} SET hidden = $2 WHERE id = $1::bigint RETURNING id`, [id, hidden])).length > 0;
}

export async function setBanned(userId: string, banned: boolean): Promise<boolean> {
  const rows = await q("UPDATE community_users SET banned = $2 WHERE id = $1::bigint RETURNING id", [userId, banned]);
  if (banned && rows.length) await q("DELETE FROM community_sessions WHERE user_id = $1::bigint", [userId]);
  return rows.length > 0;
}

export async function resolveReports(kind: PostKind, id: string): Promise<void> {
  await q("UPDATE community_reports SET resolved = true WHERE kind = $1 AND target_id = $2", [kind, id]);
}

/** A short excerpt of any post, with its author, for the owner's email and admin page. */
export async function postSummary(kind: PostKind, id: string): Promise<{ excerpt: string; username: string | null; where: string } | null> {
  const col = kind === "thread" ? "p.title || ': ' || p.body" : "p.body";
  const where = kind === "comment" ? "p.target" : kind === "review" ? "'product:' || p.product" : "'thread:' || p.id::text";
  const [r] = await q(`SELECT left(${col}, 300) AS excerpt, u.username, ${where} AS loc FROM ${TABLE[kind]} p JOIN community_users u ON u.id = p.user_id WHERE p.id = $1::bigint`, [id]);
  return r ? { excerpt: String(r.excerpt ?? ""), username: (r.username as string | null) ?? null, where: String(r.loc ?? "") } : null;
}

export type AdminReport = { kind: PostKind; targetId: string; reports: number; reasons: string[]; notes: string[]; lastAt: string; excerpt: string; author: string | null; authorId: string | null; authorBanned: boolean; hidden: boolean; where: string };
export type AdminPost = { kind: PostKind; id: string; createdAt: string; excerpt: string; author: string | null; authorId: string; authorBanned: boolean; hidden: boolean; deleted: boolean; where: string };

/** Unresolved reports, grouped per post, newest first. */
export async function adminReports(limit = 50): Promise<AdminReport[]> {
  const rows = await q(
    `WITH g AS (
       SELECT kind, target_id, count(*)::int AS n, array_agg(DISTINCT reason) AS reasons, array_remove(array_agg(note), NULL) AS notes, max(created_at) AS last_at
       FROM community_reports WHERE NOT resolved GROUP BY kind, target_id ORDER BY max(created_at) DESC LIMIT $1)
     SELECT g.*, p.excerpt, p.username, p.uid, p.banned, p.hidden, p.loc FROM g LEFT JOIN LATERAL (
       SELECT left(c.body, 300) AS excerpt, u.username, u.id::text AS uid, u.banned, c.hidden, c.target AS loc FROM community_comments c JOIN community_users u ON u.id = c.user_id WHERE g.kind = 'comment' AND c.id::text = g.target_id
       UNION ALL SELECT left(r.body, 300), u.username, u.id::text, u.banned, r.hidden, 'product:' || r.product FROM community_reviews r JOIN community_users u ON u.id = r.user_id WHERE g.kind = 'review' AND r.id::text = g.target_id
       UNION ALL SELECT left(t.title || ': ' || t.body, 300), u.username, u.id::text, u.banned, t.hidden, 'thread:' || t.id::text FROM community_threads t JOIN community_users u ON u.id = t.user_id WHERE g.kind = 'thread' AND t.id::text = g.target_id
     ) p ON true ORDER BY g.last_at DESC`,
    [limit],
  );
  return rows.map((r) => ({
    kind: String(r.kind) as PostKind,
    targetId: String(r.target_id),
    reports: n(r.n),
    reasons: (r.reasons as string[] | null) ?? [],
    notes: ((r.notes as string[] | null) ?? []).filter(Boolean),
    lastAt: iso(r.last_at) ?? "",
    excerpt: String(r.excerpt ?? "(gone)"),
    author: (r.username as string | null) ?? null,
    authorId: (r.uid as string | null) ?? null,
    authorBanned: Boolean(r.banned),
    hidden: Boolean(r.hidden),
    where: String(r.loc ?? ""),
  }));
}

/** The newest comments, reviews and threads, hidden ones included. */
export async function adminRecentPosts(limit = 50): Promise<AdminPost[]> {
  const rows = await q(
    `SELECT * FROM (
       SELECT 'comment' AS kind, c.id::text AS id, c.created_at, left(c.body, 300) AS excerpt, u.username, u.id::text AS uid, u.banned, c.hidden, c.deleted, c.target AS loc FROM community_comments c JOIN community_users u ON u.id = c.user_id
       UNION ALL SELECT 'review', r.id::text, r.created_at, left(r.rating || '★ ' || r.body, 300), u.username, u.id::text, u.banned, r.hidden, false, 'product:' || r.product FROM community_reviews r JOIN community_users u ON u.id = r.user_id
       UNION ALL SELECT 'thread', t.id::text, t.created_at, left(t.title || ': ' || t.body, 300), u.username, u.id::text, u.banned, t.hidden, t.deleted, 'thread:' || t.id::text FROM community_threads t JOIN community_users u ON u.id = t.user_id
     ) p ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    kind: String(r.kind) as PostKind,
    id: String(r.id),
    createdAt: iso(r.created_at) ?? "",
    excerpt: String(r.excerpt ?? ""),
    author: (r.username as string | null) ?? null,
    authorId: String(r.uid),
    authorBanned: Boolean(r.banned),
    hidden: Boolean(r.hidden),
    deleted: Boolean(r.deleted),
    where: String(r.loc ?? ""),
  }));
}

export async function communityCounts(): Promise<{ users: number; banned: number; comments: number; reviews: number; threads: number; openReports: number }> {
  const [r] = await q(`SELECT (SELECT count(*) FROM community_users)::int AS users, (SELECT count(*) FROM community_users WHERE banned)::int AS banned,
    (SELECT count(*) FROM community_comments WHERE NOT deleted)::int AS comments, (SELECT count(*) FROM community_reviews)::int AS reviews,
    (SELECT count(*) FROM community_threads WHERE NOT deleted)::int AS threads, (SELECT count(DISTINCT (kind, target_id)) FROM community_reports WHERE NOT resolved)::int AS reports`);
  return { users: n(r?.users), banned: n(r?.banned), comments: n(r?.comments), reviews: n(r?.reviews), threads: n(r?.threads), openReports: n(r?.reports) };
}

// ---------------------------------------------------------------- owner notices

/** Counts one notice of this kind today (UTC) across every instance and returns today's count. */
export async function bumpNotice(kind: string): Promise<number> {
  const [r] = await q("INSERT INTO community_notices (day, kind, n) VALUES (current_date, $1, 1) ON CONFLICT (day, kind) DO UPDATE SET n = community_notices.n + 1 RETURNING n", [kind]);
  return n(r?.n);
}

// ---------------------------------------------------------------- profiles

export type Profile = {
  username: string;
  createdAt: string;
  karma: number;
  expert: boolean;
  comments: { id: string; createdAt: string; body: string; target: string; score: number }[];
  reviews: { id: string; createdAt: string; product: string; rating: number; body: string; score: number }[];
};

export async function profile(usernameLower: string): Promise<Profile | null> {
  const [u] = await q("SELECT id::text AS id, username, created_at FROM community_users WHERE username_lower = $1 AND NOT banned", [usernameLower]);
  if (!u) return null;
  const id = String(u.id);
  const [k, comments, reviews] = await Promise.all([
    karmaFor([id]),
    q(`SELECT c.id::text AS id, c.created_at, left(c.body, 400) AS body, c.target, ${SCORE("comment", "c.id::text")} AS score FROM community_comments c WHERE c.user_id = $1::bigint AND NOT c.hidden AND NOT c.deleted ORDER BY c.id DESC LIMIT 20`, [id]),
    q(`SELECT r.id::text AS id, r.created_at, r.product, r.rating, left(r.body, 400) AS body, ${SCORE("review", "r.id::text")} AS score FROM community_reviews r WHERE r.user_id = $1::bigint AND NOT r.hidden ORDER BY r.id DESC LIMIT 20`, [id]),
  ]);
  const karma = k.get(id)?.karma ?? 0;
  const createdAt = iso(u.created_at) ?? "";
  return {
    username: String(u.username),
    createdAt,
    karma,
    expert: isCamExpert(karma, createdAt),
    comments: comments.map((r) => ({ id: String(r.id), createdAt: iso(r.created_at) ?? "", body: String(r.body ?? ""), target: String(r.target), score: n(r.score) })),
    reviews: reviews.map((r) => ({ id: String(r.id), createdAt: iso(r.created_at) ?? "", product: String(r.product), rating: n(r.rating), body: String(r.body ?? ""), score: n(r.score) })),
  };
}
