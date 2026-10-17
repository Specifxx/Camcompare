// POST /api/community/votes {kind, target, value}: sets your vote on a comment,
// review, thread (target = its id) or deal (target = its deal key) to +1 or
// -1; 0 removes it. One vote per member per target. You can't vote on your
// own posts (CamKarma would be free). Answers with the new score.
import { postAuthor, scoreOf, setVote } from "@/lib/community/db";
import { fail, guardWrite, limiters, logSafe, privateJson, requireMember, tooMany } from "@/lib/community/http";
import { firstError, voteInput } from "@/lib/community/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const g = await guardWrite(req, 1_000);
  if ("res" in g) return g.res;
  const m = await requireMember(req);
  if ("res" in m) return m.res;
  const l = limiters.vote.hit(m.user.id);
  if (!l.ok) return tooMany(l.retryAfterS, "That's a lot of votes in a short time");
  const parsed = voteInput.safeParse(g.body);
  if (!parsed.success) return fail(400, firstError(parsed.error));
  const { kind, target, value } = parsed.data;
  try {
    if (kind !== "deal") {
      const author = await postAuthor(kind, target);
      if (!author) return fail(404, "That post is gone.");
      if (author === m.user.id) return fail(403, "You can't vote on your own posts.");
    }
    await setVote(m.user.id, kind, target, value);
    return privateJson({ ok: true, value, score: await scoreOf(kind, target) });
  } catch (e) {
    console.error(`community: vote failed: ${logSafe(e)}`);
    return fail(500, "We couldn't save your vote just now. Please try again in a minute.");
  }
}
