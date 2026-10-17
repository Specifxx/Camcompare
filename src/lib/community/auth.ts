// Community sign-in: an emailed magic link, then a signed session cookie.
// Server-only (node:crypto). The pure parts (hashing, expiry, signing, the
// same-origin check) are here so tests/community.test.ts can hold them
// without a database; lib/community/db.ts stores only hashes.
//
//  - A link token is 32 random bytes. The database keeps its SHA-256, never
//    the token, so a leaked table can't sign anyone in. It works once
//    (consumed by an UPDATE ... WHERE used_at IS NULL) and for LOGIN_TTL_MS.
//  - The link opens /community/signin, which POSTs the token: a mail
//    scanner that prefetches links (GET) can't use it up.
//  - The session cookie is `<random>.<HMAC-SHA256(AUTH_SECRET, random)>`,
//    httpOnly, Secure, SameSite=Lax. A forged cookie fails the HMAC before
//    any query; a real one is looked up by its hash, so signing out (or a
//    ban) ends it server-side. Changing AUTH_SECRET signs everyone out.
//  - Without an AUTH_SECRET of AUTH_SECRET_MIN characters, sign-in is off and
//    the forms say so; reading comments still works.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { CANONICAL_ORIGIN, SITE_URL } from "../site";

export const AUTH_SECRET_MIN = 32;
export const LOGIN_TTL_MS = 15 * 60_000;
export const SESSION_TTL_S = 30 * 24 * 3600;
export const SESSION_COOKIE = "cc_session";
/** Not a credential: "1" when signed in, readable by page scripts so a signed-out visitor's page never asks /api/community/me. */
export const HINT_COOKIE = "cc_member";
/** Sign-in emails one address may be sent per LOGIN_WINDOW_MS, and one IP per hour. */
export const LOGIN_PER_EMAIL = 3;
export const LOGIN_WINDOW_MS = 15 * 60_000;
export const LOGIN_PER_IP_HOUR = 10;

export const AUTH_OFF = "Sign-in isn't switched on yet (the site owner still has to set AUTH_SECRET). You can read everything; posting and voting open soon.";

export function authSecret(env: string | undefined = process.env.AUTH_SECRET): string | null {
  const s = (env ?? "").trim();
  return s.length >= AUTH_SECRET_MIN ? s : null;
}
export const authConfigured = () => authSecret() !== null && Boolean(process.env.DATABASE_URL?.trim());

/** 32 random bytes, base64url: 43 characters. */
export const newRawToken = () => randomBytes(32).toString("base64url");
export const isRawToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{43}$/.test(t);
/** What the database keeps instead of a token. */
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/** Whether a stored login token may still be used: not used before and not past its expiry. */
export function loginTokenUsable(row: { expiresAt: string | Date; usedAt: string | Date | null }, now = Date.now()): boolean {
  if (row.usedAt) return false;
  const exp = row.expiresAt instanceof Date ? row.expiresAt.getTime() : Date.parse(row.expiresAt);
  return Number.isFinite(exp) && now < exp;
}

export const loginExpiry = (now = Date.now()) => new Date(now + LOGIN_TTL_MS);

const mac = (secret: string, s: string) => createHmac("sha256", secret).update(`camcompare-session-v1:${s}`).digest("base64url");
const digest = (s: string) => createHash("sha256").update(s).digest();
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

export const signSession = (raw: string, secret: string) => `${raw}.${mac(secret, raw)}`;

/** The random part of a session cookie whose signature checks out, or null. */
export function verifySessionCookie(value: string | null | undefined, secret: string | null): string | null {
  if (!secret || typeof value !== "string") return null;
  const dot = value.indexOf(".");
  if (dot < 0) return null;
  const raw = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!isRawToken(raw) || !sig) return null;
  return same(sig, mac(secret, raw)) ? raw : null;
}

/** The rate-limit key stored for an IP: an HMAC, so the table never holds an address. */
export const ipKey = (ip: string, secret: string) => createHmac("sha256", secret).update(`ip:${ip}`).digest("base64url").slice(0, 32);

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * CSRF guard for every write: the browser's Origin must be this site (the
 * request's own origin, the configured site URL or the canonical one), and
 * when the browser sends Sec-Fetch-Site it must say same-origin. No Origin
 * at all is refused: every browser sends one on a cross-origin-capable POST.
 */
export function sameOrigin(h: Headers, reqUrl: string, extra: string[] = [SITE_URL, CANONICAL_ORIGIN]): boolean {
  const site = h.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = h.get("origin");
  if (!origin || origin === "null") return false;
  let own = "";
  try {
    own = new URL(reqUrl).origin;
  } catch {
    /* no own origin */
  }
  const allowed = new Set([own, ...extra.map((u) => u.replace(/\/$/, ""))].filter(Boolean));
  return allowed.has(origin);
}

type CookieOpts = { secure: boolean };
/** Set-Cookie values for a new session (and the hint), and for signing out. */
export function sessionCookies(value: string, { secure }: CookieOpts): string[] {
  const s = secure ? "; Secure" : "";
  return [`${SESSION_COOKIE}=${value}; Path=/; Max-Age=${SESSION_TTL_S}; HttpOnly; SameSite=Lax${s}`, `${HINT_COOKIE}=1; Path=/; Max-Age=${SESSION_TTL_S}; SameSite=Lax${s}`];
}
export function clearedCookies({ secure }: CookieOpts): string[] {
  const s = secure ? "; Secure" : "";
  return [`${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${s}`, `${HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${s}`];
}
