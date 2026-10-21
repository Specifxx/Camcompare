// GET /api/community/stories/<id>/own: your own story as you wrote it, cover
// included (the public read shows a cover only once featured), for the editor.
// Per member: never cached.
import { fail, logSafe, privateJson, requireMember } from "@/lib/community/http";
import { ID_RE } from "@/lib/community/rules";
import { myStory } from "@/lib/community/stories-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!ID_RE.test(params.id)) return fail(404, "That story doesn't exist.");
  const m = await requireMember(req);
  if ("res" in m) return m.res;
  try {
    const s = await myStory(params.id, m.user.id);
    return s ? privateJson({ ok: true, story: s }) : fail(404, "You can only edit your own stories.");
  } catch (e) {
    console.error(`community: own story read failed: ${logSafe(e)}`);
    return fail(500, "Your story didn't load. Please try again in a minute.");
  }
}
