// DELETE /api/community/reviews/<id>: remove your own review (and the votes on it).
import { deleteReview } from "@/lib/community/db";
import { fail, guardWrite, logSafe, privateJson, requireMember } from "@/lib/community/http";
import { ID_RE } from "@/lib/community/rules";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!ID_RE.test(params.id)) return fail(404, "That review is gone.");
  const g = await guardWrite(req);
  if ("res" in g) return g.res;
  const m = await requireMember(req, { needUsername: false });
  if ("res" in m) return m.res;
  try {
    if (!(await deleteReview(params.id, m.user.id))) return fail(404, "You can only delete your own review.");
    return privateJson({ ok: true });
  } catch (e) {
    console.error(`community: review delete failed: ${logSafe(e)}`);
    return fail(500, "We couldn't delete that just now. Please try again in a minute.");
  }
}
