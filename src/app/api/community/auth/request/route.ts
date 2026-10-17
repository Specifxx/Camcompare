// POST /api/community/auth/request {email, next?}: emails a sign-in link
// (lib/community/auth.ts). The answer is the same whether or not the address
// has an account, so the form can't be used to find out who is a member.
// Limits: LOGIN_PER_EMAIL links per address per 15 minutes and
// LOGIN_PER_IP_HOUR per IP, counted in the database (every instance sees
// them), plus a per-instance IP limiter in front. Logs never carry the address.
import { emailBody, emailConfigured, sendEmail } from "@/lib/alerts";
import { AUTH_OFF, authSecret, hashToken, ipKey, LOGIN_PER_EMAIL, LOGIN_PER_IP_HOUR, LOGIN_TTL_MS, LOGIN_WINDOW_MS, loginExpiry, newRawToken } from "@/lib/community/auth";
import { createLoginToken, loginRequestCounts } from "@/lib/community/db";
import { clientIp, fail, guardWrite, limiters, logSafe, privateJson, tooMany } from "@/lib/community/http";
import { firstError, signInInput, sitePath } from "@/lib/community/validate";
import { abs } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SENT = { ok: true, sent: true };

export async function POST(req: Request) {
  const g = await guardWrite(req, 2_000);
  if ("res" in g) return g.res;
  const secret = authSecret();
  if (!secret || !emailConfigured()) return fail(503, AUTH_OFF);
  const ip = clientIp(req.headers);
  const l = limiters.signInIp.hit(ip);
  if (!l.ok) return tooMany(l.retryAfterS, "That's a lot of sign-in emails");

  const parsed = signInInput.safeParse(g.body);
  if (!parsed.success) return fail(400, firstError(parsed.error));
  if (parsed.data.website) return privateJson(SENT); // honeypot
  const { email } = parsed.data;
  const key = ipKey(ip, secret);

  try {
    const c = await loginRequestCounts(email, key, LOGIN_WINDOW_MS);
    if (c.byIp >= LOGIN_PER_IP_HOUR) return tooMany(600, "That's a lot of sign-in emails");
    // Same answer as a sent link: a mail-bomber learns nothing, the owner of the inbox gets no more mail.
    if (c.byEmail >= LOGIN_PER_EMAIL) return privateJson(SENT);
    const token = newRawToken();
    await createLoginToken({ tokenHash: hashToken(token), email, ipKey: key, next: sitePath(parsed.data.next), expiresAt: loginExpiry() });
    const url = abs(`/community/signin?token=${token}`);
    const mins = Math.round(LOGIN_TTL_MS / 60_000);
    const body = emailBody({
      lines: [`Here's your link to sign in to the CamCompare community. It works once, for ${mins} minutes.`, "If you didn't ask for it, ignore this email: nobody can sign in without the link."],
      button: { label: "Sign in to CamCompare", url },
      footer: ["You're getting this because someone entered this address on camcompare.app.", "Your email is never shown to anyone: other members only see the username you pick."],
    });
    await sendEmail({ to: email, subject: "Your CamCompare sign-in link", ...body });
    return privateJson(SENT);
  } catch (e) {
    console.error(`community: sign-in email failed: ${logSafe(e)}`);
    return fail(500, "We couldn't send that just now. Please try again in a minute.");
  }
}
