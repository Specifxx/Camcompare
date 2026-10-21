// DELETE /api/community/requests/<id>: withdraw your own request.
import { fail, guardWrite, logSafe, privateJson, requireMember } from "@/lib/community/http";
import { ID_RE } from "@/lib/community/rules";
import { deleteRequest } from "@/lib/community/stories-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!ID_RE.test(params.id)) return fail(404, "That request is gone.");
  const g = await guardWrite(req);
  if ("res" in g) return g.res;
  const m = await requireMember(req, { needUsername: false });
  if ("res" in m) return m.res;
  try {
    if (!(await deleteRequest(params.id, m.user.id))) return fail(404, "You can only withdraw your own requests.");
    return privateJson({ ok: true });
  } catch (e) {
    console.error(`community: request delete failed: ${logSafe(e)}`);
    return fail(500, "We couldn't do that just now. Please try again in a minute.");
  }
}
