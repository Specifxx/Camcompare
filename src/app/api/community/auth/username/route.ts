// POST /api/community/auth/username {username}: a member's public name, picked
// once at first sign-in. Unique ignoring case (a unique index on its lowercase).
import { setUsername } from "@/lib/community/db";
import { fail, guardWrite, logSafe, privateJson, requireMember } from "@/lib/community/http";
import { notifyOwnerBounded } from "@/lib/community/notify";
import { checkUsername, userPath } from "@/lib/community/rules";
import { usernameInput } from "@/lib/community/validate";
import { abs } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const g = await guardWrite(req, 500);
  if ("res" in g) return g.res;
  const m = await requireMember(req, { needUsername: false });
  if ("res" in m) return m.res;
  const parsed = usernameInput.safeParse(g.body);
  const check = checkUsername(parsed.success ? parsed.data.username : "");
  if (!check.ok) return fail(400, check.error);
  try {
    const r = await setUsername(m.user.id, check.username, check.lower);
    if (r === "taken") return fail(409, "Someone already has that name. Please pick another.");
    if (r === "already") return fail(409, "You've already picked a username.");
    await notifyOwnerBounded("signup", `New member: ${check.username}`, [`${check.username} joined the community.`, abs(userPath(check.username))]);
    return privateJson({ ok: true, username: check.username });
  } catch (e) {
    console.error(`community: username failed: ${logSafe(e)}`);
    return fail(500, "We couldn't save that just now. Please try again in a minute.");
  }
}
