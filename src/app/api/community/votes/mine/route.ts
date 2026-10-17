// GET /api/community/votes/mine?kind=comment&ids=1,2,3: your own votes on up to
// 100 targets, so the arrows you clicked stay lit. Per member: never cached.
// Signed out (or no sign-in yet): an empty map.
import { myVotes } from "@/lib/community/db";
import { currentUser, fail, logSafe, privateJson } from "@/lib/community/http";
import { DEAL_KEY_RE, DEAL_KEYS_MAX, ID_RE, VOTE_KINDS, type VoteKind } from "@/lib/community/rules";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const kind = u.searchParams.get("kind") as VoteKind;
  if (!(VOTE_KINDS as readonly string[]).includes(kind)) return fail(400, "Unknown kind.");
  const re = kind === "deal" ? DEAL_KEY_RE : ID_RE;
  const ids = [...new Set((u.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter((s) => re.test(s)))].slice(0, DEAL_KEYS_MAX);
  try {
    const me = await currentUser(req);
    if (!me || me.banned || !ids.length) return privateJson({ ok: true, votes: {} });
    return privateJson({ ok: true, votes: await myVotes(me.id, kind, ids) });
  } catch (e) {
    console.error(`community: my votes failed: ${logSafe(e)}`);
    return privateJson({ ok: true, votes: {} });
  }
}
