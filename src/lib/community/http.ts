// Shared plumbing for /api/community/* route handlers: replies with the right
// cache headers, the write guard (configured, JSON, same origin, size) and
// the signed-in member. Reads are public and CDN-cached for 30 s (stale for
// 60 more) so a busy page costs the database one query a minute, not one
// per visitor; they never carry anything about who is asking. Writes, and
// anything per member, are no-store.
import { createRateLimiter, clientIp, logSafe } from "../feedback";
import { AUTH_OFF, authSecret, hashToken, readCookie, sameOrigin, SESSION_COOKIE, verifySessionCookie } from "./auth";
import { COMMUNITY_NOT_CONNECTED, communityConfigured, sessionUser, type User } from "./db";

export const PUBLIC_CACHE = "public, s-maxage=30, stale-while-revalidate=60";
const BASE = { "X-Robots-Tag": "noindex", "X-Content-Type-Options": "nosniff" };

export const publicJson = (body: unknown, status = 200) => Response.json(body, { status, headers: { ...BASE, "Cache-Control": status === 200 ? PUBLIC_CACHE : "no-store" } });
export const privateJson = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers: { ...BASE, "Cache-Control": "private, no-store", ...headers } });
export const fail = (status: number, error: string, headers: Record<string, string> = {}) => privateJson({ ok: false, error }, status, headers);

/** Secure cookies everywhere but plain-http localhost (development). */
export function secureRequest(req: Request): boolean {
  try {
    const u = new URL(req.url);
    return u.protocol === "https:" || !["localhost", "127.0.0.1"].includes(u.hostname);
  } catch {
    return true;
  }
}

export { clientIp, logSafe };

/** Per-instance limits, in memory like the feedback form's (lib/feedback.ts). */
export const limiters = {
  signInIp: createRateLimiter({ limit: 10, windowMs: 15 * 60_000 }),
  post: createRateLimiter({ limit: 6, windowMs: 10 * 60_000 }),
  postIp: createRateLimiter({ limit: 20, windowMs: 10 * 60_000 }),
  vote: createRateLimiter({ limit: 60, windowMs: 60_000 }),
  report: createRateLimiter({ limit: 10, windowMs: 60 * 60_000 }),
  readIp: createRateLimiter({ limit: 240, windowMs: 60_000, maxKeys: 20_000 }),
};
/** Posts per member in POST_WINDOW_MIN across every instance (checked in the database). */
export const POSTS_PER_WINDOW = 8;
export const POST_WINDOW_MIN = 10;

export const tooMany = (retryAfterS: number, what = "That's a lot in a short time") => fail(429, `${what}. Please try again in a few minutes.`, { "Retry-After": String(retryAfterS) });

/** A read's guard: the database must be configured; a runaway client is slowed. */
export function guardRead(req: Request): Response | null {
  if (!communityConfigured()) return fail(503, COMMUNITY_NOT_CONNECTED);
  const l = limiters.readIp.hit(clientIp(req.headers));
  return l.ok ? null : tooMany(l.retryAfterS, "That's a lot of requests");
}

/**
 * Every write: configured, JSON (another site's plain form can't send it
 * without a CORS preflight, which these routes never answer), from this
 * site's own pages (Origin), and small. Returns the parsed body or the reply.
 */
export async function guardWrite(req: Request, maxBody = 20_000, { needAuth = true } = {}): Promise<{ body: unknown } | { res: Response }> {
  if (!communityConfigured()) return { res: fail(503, COMMUNITY_NOT_CONNECTED) };
  if (needAuth && !authSecret()) return { res: fail(503, AUTH_OFF) };
  if (!sameOrigin(req.headers, req.url)) return { res: fail(403, "This form only works from the CamCompare site itself.") };
  if (req.method !== "DELETE" && !(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return { res: fail(415, "Send the form as JSON.") };
  if (Number(req.headers.get("content-length") ?? 0) > maxBody) return { res: fail(413, "That's too long.") };
  if (req.method === "DELETE") return { body: null };
  try {
    const text = await req.text();
    if (text.length > maxBody) return { res: fail(413, "That's too long.") };
    return { body: JSON.parse(text) };
  } catch {
    return { res: fail(400, "Something in the form isn't right. Please try again.") };
  }
}

/** The raw session token from the request's cookie, when its signature checks out. */
export function sessionToken(req: Request): string | null {
  return verifySessionCookie(readCookie(req.headers.get("cookie"), SESSION_COOKIE), authSecret());
}

/** The signed-in member, or null. Never throws for a bad cookie. */
export async function currentUser(req: Request): Promise<User | null> {
  const raw = sessionToken(req);
  if (!raw) return null;
  return sessionUser(hashToken(raw));
}

/**
 * The member a write needs: signed in, not banned and (by default) with a
 * username. Returns the member or the reply to send instead.
 */
export async function requireMember(req: Request, { needUsername = true } = {}): Promise<{ user: User } | { res: Response }> {
  let user: User | null = null;
  try {
    user = await currentUser(req);
  } catch (e) {
    console.error(`community: session lookup failed: ${logSafe(e)}`);
    return { res: fail(500, "We couldn't check your sign-in just now. Please try again in a minute.") };
  }
  if (!user) return { res: fail(401, "Sign in to do that.") };
  if (user.banned) return { res: fail(403, "This account can't post or vote.") };
  if (needUsername && !user.username) return { res: fail(409, "Pick a username first.") };
  return { user };
}

/** A page number from a query string: 1 to PAGE_MAX. */
export const pageParam = (raw: string | null, max: number) => {
  const p = Number(raw ?? 1);
  return Number.isInteger(p) && p >= 1 ? Math.min(p, max) : 1;
};
