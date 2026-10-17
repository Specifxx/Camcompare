// GET    /api/community/threads/<id>: one thread (public, CDN-cached 30 s).
// PATCH  /api/community/threads/<id> {title, body}: edit your own.
// DELETE /api/community/threads/<id>: delete your own (replies stay under "[deleted]").
import { deleteThread, editThread, getThread } from "@/lib/community/db";
import { fail, guardRead, guardWrite, logSafe, privateJson, publicJson, requireMember } from "@/lib/community/http";
import { ID_RE } from "@/lib/community/rules";
import { firstError, threadEdit } from "@/lib/community/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export async function GET(req: Request, { params }: Ctx) {
  const blocked = guardRead(req);
  if (blocked) return blocked;
  if (!ID_RE.test(params.id)) return fail(404, "That thread doesn't exist.");
  try {
    const t = await getThread(params.id);
    return t ? publicJson({ ok: true, thread: t }) : fail(404, "That thread doesn't exist or was removed.");
  } catch (e) {
    console.error(`community: thread read failed: ${logSafe(e)}`);
    return fail(500, "The thread didn't load. Please try again in a minute.");
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!ID_RE.test(params.id)) return fail(404, "That thread is gone.");
  const g = await guardWrite(req);
  if ("res" in g) return g.res;
  const m = await requireMember(req);
  if ("res" in m) return m.res;
  const parsed = threadEdit.safeParse(g.body);
  if (!parsed.success) return fail(400, firstError(parsed.error));
  try {
    if (!(await editThread(params.id, m.user.id, parsed.data.title, parsed.data.body))) return fail(404, "You can only edit your own threads.");
    return privateJson({ ok: true, ...parsed.data, editedAt: new Date().toISOString() });
  } catch (e) {
    console.error(`community: thread edit failed: ${logSafe(e)}`);
    return fail(500, "We couldn't save that just now. Please try again in a minute.");
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  if (!ID_RE.test(params.id)) return fail(404, "That thread is gone.");
  const g = await guardWrite(req);
  if ("res" in g) return g.res;
  const m = await requireMember(req, { needUsername: false });
  if ("res" in m) return m.res;
  try {
    if (!(await deleteThread(params.id, m.user.id))) return fail(404, "You can only delete your own threads.");
    return privateJson({ ok: true });
  } catch (e) {
    console.error(`community: thread delete failed: ${logSafe(e)}`);
    return fail(500, "We couldn't delete that just now. Please try again in a minute.");
  }
}
