// PATCH  /api/community/comments/<id> {body}: edit your own comment.
// DELETE /api/community/comments/<id>: delete your own (its text goes; replies stay).
import { deleteComment, editComment } from "@/lib/community/db";
import { fail, guardWrite, logSafe, privateJson, requireMember } from "@/lib/community/http";
import { ID_RE } from "@/lib/community/rules";
import { commentEdit, firstError } from "@/lib/community/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, { params }: Ctx) {
  if (!ID_RE.test(params.id)) return fail(404, "That comment is gone.");
  const g = await guardWrite(req);
  if ("res" in g) return g.res;
  const m = await requireMember(req);
  if ("res" in m) return m.res;
  const parsed = commentEdit.safeParse(g.body);
  if (!parsed.success) return fail(400, firstError(parsed.error));
  try {
    if (!(await editComment(params.id, m.user.id, parsed.data.body))) return fail(404, "You can only edit your own comments.");
    return privateJson({ ok: true, body: parsed.data.body, editedAt: new Date().toISOString() });
  } catch (e) {
    console.error(`community: comment edit failed: ${logSafe(e)}`);
    return fail(500, "We couldn't save that just now. Please try again in a minute.");
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  if (!ID_RE.test(params.id)) return fail(404, "That comment is gone.");
  const g = await guardWrite(req);
  if ("res" in g) return g.res;
  const m = await requireMember(req, { needUsername: false });
  if ("res" in m) return m.res;
  try {
    if (!(await deleteComment(params.id, m.user.id))) return fail(404, "You can only delete your own comments.");
    return privateJson({ ok: true });
  } catch (e) {
    console.error(`community: comment delete failed: ${logSafe(e)}`);
    return fail(500, "We couldn't delete that just now. Please try again in a minute.");
  }
}
