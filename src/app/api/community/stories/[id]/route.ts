// GET    /api/community/stories/<id>: one story (public, CDN-cached 30 s).
// PATCH  /api/community/stories/<id> {title, body, verdict?, cover?, tags, products}: edit your own
//        (a featured story leaves the featured list until the owner looks again).
// DELETE /api/community/stories/<id>: delete your own (comments stay under "[deleted]").
import { fail, guardRead, guardWrite, logSafe, privateJson, publicJson, requireMember } from "@/lib/community/http";
import { ID_RE } from "@/lib/community/rules";
import { deleteStory, editStory, getStory, knownProducts } from "@/lib/community/stories-db";
import { firstError, storyInput } from "@/lib/community/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export async function GET(req: Request, { params }: Ctx) {
  const blocked = guardRead(req);
  if (blocked) return blocked;
  if (!ID_RE.test(params.id)) return fail(404, "That story doesn't exist.");
  try {
    const s = await getStory(params.id);
    return s ? publicJson({ ok: true, story: s }) : fail(404, "That story doesn't exist or was removed.");
  } catch (e) {
    console.error(`community: story read failed: ${logSafe(e)}`);
    return fail(500, "The story didn't load. Please try again in a minute.");
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!ID_RE.test(params.id)) return fail(404, "That story is gone.");
  const g = await guardWrite(req, 80_000);
  if ("res" in g) return g.res;
  const m = await requireMember(req);
  if ("res" in m) return m.res;
  const parsed = storyInput.safeParse(g.body);
  if (!parsed.success) return fail(400, firstError(parsed.error));
  const s = parsed.data;
  const known = knownProducts(s.products);
  if (!known.ok) return fail(400, `We don't list "${known.slug}". Pick products from the search.`);
  try {
    if (!(await editStory(params.id, m.user.id, { title: s.title, body: s.body, verdict: s.verdict || null, cover: s.cover, tags: s.tags, products: s.products }))) return fail(404, "You can only edit your own stories.");
    return privateJson({ ok: true, id: params.id });
  } catch (e) {
    console.error(`community: story edit failed: ${logSafe(e)}`);
    return fail(500, "We couldn't save that just now. Please try again in a minute.");
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  if (!ID_RE.test(params.id)) return fail(404, "That story is gone.");
  const g = await guardWrite(req);
  if ("res" in g) return g.res;
  const m = await requireMember(req, { needUsername: false });
  if ("res" in m) return m.res;
  try {
    if (!(await deleteStory(params.id, m.user.id))) return fail(404, "You can only delete your own stories.");
    return privateJson({ ok: true });
  } catch (e) {
    console.error(`community: story delete failed: ${logSafe(e)}`);
    return fail(500, "We couldn't delete that just now. Please try again in a minute.");
  }
}
