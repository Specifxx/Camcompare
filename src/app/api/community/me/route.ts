// GET /api/community/me: who is signed in (username, CamKarma, badge), or
// null. Per member, so never cached. Also says whether sign-in is switched on.
import { authSecret } from "@/lib/community/auth";
import { communityConfigured, karmaFor } from "@/lib/community/db";
import { currentUser, logSafe, privateJson } from "@/lib/community/http";
import { isCamExpert, type Me } from "@/lib/community/rules";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const connected = communityConfigured();
  const signIn = connected && Boolean(authSecret());
  if (!signIn) return privateJson({ connected, signIn, user: null });
  try {
    const u = await currentUser(req);
    if (!u || u.banned) return privateJson({ connected, signIn, user: null, banned: Boolean(u?.banned) });
    const k = (await karmaFor([u.id])).get(u.id);
    const karma = k?.karma ?? 0;
    const me: Me = { username: u.username, karma, expert: isCamExpert(karma, u.createdAt), createdAt: u.createdAt };
    return privateJson({ connected, signIn, user: me });
  } catch (e) {
    console.error(`community: me failed: ${logSafe(e)}`);
    return privateJson({ connected, signIn, user: null, error: "We couldn't check your sign-in just now." }, 500);
  }
}
