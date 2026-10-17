// POST /api/community/auth/verify {token}: spends a sign-in link and starts a
// session. A POST from /community/signin, never the emailed GET itself, so a
// mail scanner that opens links can't use the token up. The token is
// single-use and expires after 15 minutes (consumeLoginToken).
import { authSecret, hashToken, isRawToken, newRawToken, sessionCookies, signSession, SESSION_TTL_S } from "@/lib/community/auth";
import { consumeLoginToken, createSession, upsertUserByEmail } from "@/lib/community/db";
import { fail, guardWrite, logSafe, privateJson, secureRequest } from "@/lib/community/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const g = await guardWrite(req, 1_000);
  if ("res" in g) return g.res;
  const token = (g.body as { token?: unknown } | null)?.token;
  const expired = "That sign-in link has expired or was already used. Ask for a new one below.";
  if (!isRawToken(token)) return fail(400, expired);
  try {
    const t = await consumeLoginToken(hashToken(token));
    if (!t) return fail(410, expired);
    const user = await upsertUserByEmail(t.email);
    if (user.banned) return fail(403, "This account can't sign in.");
    const raw = newRawToken();
    await createSession(user.id, hashToken(raw), new Date(Date.now() + SESSION_TTL_S * 1000));
    const headers = new Headers({ "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "Content-Type": "application/json" });
    for (const c of sessionCookies(signSession(raw, authSecret()!), { secure: secureRequest(req) })) headers.append("Set-Cookie", c);
    return new Response(JSON.stringify({ ok: true, needsUsername: !user.username, next: t.next }), { status: 200, headers });
  } catch (e) {
    console.error(`community: sign-in failed: ${logSafe(e)}`);
    return privateJson({ ok: false, error: "We couldn't sign you in just now. Please try again in a minute." }, 500);
  }
}
