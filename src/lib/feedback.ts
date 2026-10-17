// Private feedback: the one thing CamCompare keeps in a database. Public data
// (catalog, prices, history) stays committed JSON with no database at all
// (DECISIONS.md, founding decisions). Feedback can't: it carries visitors'
// email addresses, and the repo is public. So: one small table in one free
// Neon project, written by POST /api/feedback, read by the owner's /admin page.
// Server-only (node:crypto, the Neon driver); the form's half is
// lib/feedback-kinds.ts.
//
// Transfer stays tiny: one INSERT per message, and the admin page reads at
// most ADMIN_LIST_MAX rows when the owner opens it. Nothing public reads it.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { EMAIL_MAX, FEEDBACK_KINDS, MESSAGE_MAX, MESSAGE_MIN, MIN_FILL_MS, PAGE_MAX, type FeedbackKind } from "./feedback-kinds";
import { MARKET_CODES, type MarketCode } from "./markets";

export const NOT_CONNECTED = "Feedback isn't connected yet. Please check back soon.";
export const USER_AGENT_MAX = 300;
export const ADMIN_LIST_MAX = 500;

// ---------------------------------------------------------------- validation

// Postgres text can't hold NUL, and nothing a person types needs it.
const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\u0000/g, "").trim() : v);

export const feedbackInput = z.object({
  kind: z.enum(FEEDBACK_KINDS).default("other"),
  message: z.preprocess(clean, z.string().min(MESSAGE_MIN, `Write a little more (at least ${MESSAGE_MIN} characters).`).max(MESSAGE_MAX, `Keep it under ${MESSAGE_MAX} characters.`)),
  email: z.preprocess(clean, z.union([z.literal(""), z.string().max(EMAIL_MAX).email("That email doesn't look right. Leave it empty if you don't need a reply.")]).optional()),
  page: z.preprocess(clean, z.string().max(PAGE_MAX).optional()),
  market: z.enum(MARKET_CODES).optional().catch(undefined),
  /** Milliseconds between the form opening and Send, measured by the form. */
  elapsedMs: z.number().int().nonnegative().optional(),
  /** Honeypot: hidden from people, filled by bots. */
  website: z.string().max(PAGE_MAX).optional(),
});

export type FeedbackRowInput = { kind: FeedbackKind; message: string; email: string | null; page: string | null; market: MarketCode | null; userAgent: string | null };

export type Verdict =
  | { action: "store"; row: FeedbackRowInput }
  | { action: "drop" } // honeypot: answer "ok" so the bot learns nothing, store nothing
  | { action: "reject"; status: number; error: string };

/** A site path only ("/cameras/x?y"): never another host, never a "//host" URL. */
const sitePath = (p: string | undefined) => (p && p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/\\") ? p : null);

/** What to do with one submission. Pure, so tests need no database. */
export function checkSubmission(body: unknown, userAgent: string | null = null): Verdict {
  const parsed = feedbackInput.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { action: "reject", status: 400, error: issue?.path[0] === "message" || issue?.path[0] === "email" ? issue.message : "Something in the form isn't right. Please check it and try again." };
  }
  const d = parsed.data;
  if (d.website) return { action: "drop" };
  if (d.elapsedMs === undefined || d.elapsedMs < MIN_FILL_MS) return { action: "reject", status: 422, error: "That was quick! Please wait a moment and press Send again." };
  return {
    action: "store",
    row: {
      kind: d.kind,
      message: d.message,
      email: d.email || null,
      page: sitePath(d.page),
      market: d.market ?? null,
      userAgent: userAgent ? userAgent.replace(/\u0000/g, "").slice(0, USER_AGENT_MAX) : null,
    },
  };
}

// ---------------------------------------------------------------- rate limit

/**
 * Sliding-window limit per key (the client IP), in memory. Per server
 * instance, so a determined sender spread over instances gets a few more:
 * fine for a feedback form. Never stored anywhere.
 */
export function createRateLimiter({ limit, windowMs, maxKeys = 5000 }: { limit: number; windowMs: number; maxKeys?: number }) {
  const hits = new Map<string, number[]>();
  return {
    hit(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfterS: number } {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { ok: false, retryAfterS: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > maxKeys) {
        for (const [k, ts] of hits) if (!ts.some((t) => now - t < windowMs)) hits.delete(k);
        if (hits.size > maxKeys) hits.clear();
      }
      return { ok: true };
    },
    size: () => hits.size,
  };
}

/** Five messages per IP per ten minutes. */
export const feedbackLimiter = createRateLimiter({ limit: 5, windowMs: 10 * 60_000 });

/** The visitor's IP as Vercel reports it (it overwrites any the client sends). Used only as the rate-limit key. */
export function clientIp(h: Headers): string {
  return h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// ---------------------------------------------------------------- admin key

// The owner's link is /admin/<ADMIN_KEY>. A key shorter than this never
// matches, so a guessable one ("admin", "1234") can't open the page.
export const ADMIN_KEY_MIN = 16;
export const ADMIN_COOKIE = "cc_admin";
export const ADMIN_COOKIE_MAX_AGE = 30 * 24 * 3600;

const digest = (s: string) => createHash("sha256").update(s).digest();
/** Constant-time string equality: both sides are hashed first, so length leaks nothing either. */
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));
const configuredKey = (key: string | undefined) => {
  const k = (key ?? "").trim();
  return k.length >= ADMIN_KEY_MIN ? k : null;
};

export function adminKeyMatches(given: string | null | undefined, key = process.env.ADMIN_KEY): boolean {
  const want = configuredKey(key);
  if (!want || typeof given !== "string") return false;
  let got = given;
  try {
    got = decodeURIComponent(given);
  } catch {
    /* not percent-encoded: compare as is */
  }
  return same(got, want);
}

/**
 * The cookie the admin link sets, so the page itself can live at /admin and
 * the key never stays in a URL that page scripts (analytics, ads) can read.
 * Derived from the key: changing ADMIN_KEY signs every browser out.
 */
export function adminSessionToken(key = process.env.ADMIN_KEY): string | null {
  const k = configuredKey(key);
  return k ? createHmac("sha256", k).update("camcompare-admin-session-v1").digest("base64url") : null;
}

export function adminSessionValid(token: string | null | undefined, key = process.env.ADMIN_KEY): boolean {
  const want = adminSessionToken(key);
  return Boolean(want && typeof token === "string" && token && same(token, want));
}

// ---------------------------------------------------------------- storage

export const feedbackConfigured = () => Boolean(process.env.DATABASE_URL?.trim());

type Sql = ReturnType<typeof neon>;
let sql: Sql | null = null;
let sqlUrl = "";
let ready: Promise<void> | null = null;

function db(): Sql {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set");
  // no-store: never let Next.js put a query response in its Data Cache.
  if (!sql || url !== sqlUrl) {
    sql = neon(url, { fetchOptions: { cache: "no-store" } });
    sqlUrl = url;
    ready = null;
  }
  return sql;
}

// Each query gets its own timeout (a Neon free-tier compute can take a few
// seconds to wake, never this long).
const opts = () => ({ fetchOptions: { cache: "no-store" as const, signal: AbortSignal.timeout(9000) } });

/** The table is made on first use; IF NOT EXISTS makes a second instance's attempt harmless. */
function ensureTable(s: Sql): Promise<void> {
  ready ??= s
    .query(
      "CREATE TABLE IF NOT EXISTS feedback (id bigserial primary key, created_at timestamptz default now(), kind text, message text, email text, page text, market text, user_agent text)",
      [],
      opts(),
    )
    .then(
      () => undefined,
      (e: { code?: string }) => {
        // Two instances creating it at once: the loser sees a duplicate; the table exists.
        if (e?.code === "42P07" || e?.code === "23505") return;
        ready = null;
        throw e;
      },
    );
  return ready;
}

export async function saveFeedback(row: FeedbackRowInput): Promise<void> {
  const s = db();
  await ensureTable(s);
  await s.query(
    "INSERT INTO feedback (kind, message, email, page, market, user_agent) VALUES ($1, $2, $3, $4, $5, $6)",
    [row.kind, row.message, row.email, row.page, row.market, row.userAgent],
    opts(),
  );
}

export type FeedbackRow = { id: string; createdAt: string; kind: string; message: string; email: string | null; page: string | null; market: string | null; userAgent: string | null };

/** Newest first, at most ADMIN_LIST_MAX, optionally one kind. */
export async function listFeedback(kind?: FeedbackKind): Promise<FeedbackRow[]> {
  const s = db();
  await ensureTable(s);
  const rows = (await s.query(
    `SELECT id::text AS id, created_at, kind, message, email, page, market, user_agent FROM feedback ${kind ? "WHERE kind = $2" : ""} ORDER BY id DESC LIMIT $1`,
    kind ? [ADMIN_LIST_MAX, kind] : [ADMIN_LIST_MAX],
    opts(),
  )) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ""),
    kind: String(r.kind ?? "other"),
    message: String(r.message ?? ""),
    email: (r.email as string | null) ?? null,
    page: (r.page as string | null) ?? null,
    market: (r.market as string | null) ?? null,
    userAgent: (r.user_agent as string | null) ?? null,
  }));
}

/** Messages per kind, every row (not only the listed ones). */
export async function feedbackCounts(): Promise<Record<string, number>> {
  const s = db();
  await ensureTable(s);
  const rows = (await s.query("SELECT kind, count(*)::int AS n FROM feedback GROUP BY kind", [], opts())) as { kind: string | null; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.kind ?? "other", Number(r.n)]));
}

/** An error for the log: its kind and message, never a connection string or what the visitor wrote. */
export function logSafe(e: unknown): string {
  const err = e as { name?: string; code?: string; message?: string };
  const msg = String(err?.message ?? e).replace(/postgres(ql)?:\/\/\S+/gi, "postgres://[redacted]").slice(0, 200);
  return `${err?.name ?? "Error"}${err?.code ? ` ${err.code}` : ""}: ${msg}`;
}
