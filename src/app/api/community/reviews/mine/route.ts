// GET /api/community/reviews/mine?product=<slug>: your own review of a product
// (to edit it), or null. Per member: never cached.
import { myReview } from "@/lib/community/db";
import { currentUser, fail, logSafe, privateJson } from "@/lib/community/http";
import { SLUG_RE } from "@/lib/community/rules";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("product") ?? "";
  if (!SLUG_RE.test(slug)) return fail(400, "Unknown product.");
  try {
    const me = await currentUser(req);
    return privateJson({ ok: true, review: me && !me.banned ? await myReview(me.id, slug) : null });
  } catch (e) {
    console.error(`community: my review failed: ${logSafe(e)}`);
    return privateJson({ ok: true, review: null });
  }
}
