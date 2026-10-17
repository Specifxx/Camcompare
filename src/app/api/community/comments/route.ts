// GET  /api/community/comments?target=product:<slug>&sort=top|new&page=1
//      Public, CDN-cached 30 s: top-level comments a page at a time, each with
//      its replies (one level). Nothing about the visitor.
// POST /api/community/comments {target, body, parentId?}: a signed-in member's
//      comment or reply. A reply to a reply attaches to its top-level comment.
import { createComment, getComment, listComments, recentPosts } from "@/lib/community/db";
import { clientIp, fail, guardRead, guardWrite, limiters, logSafe, pageParam, POST_WINDOW_MIN, POSTS_PER_WINDOW, privateJson, publicJson, requireMember, tooMany } from "@/lib/community/http";
import { notifyOwnerBounded } from "@/lib/community/notify";
import { isSort, PAGE_MAX, parseTarget, targetKey } from "@/lib/community/rules";
import { targetExists, targetLink } from "@/lib/community/targets";
import { commentInput, firstError } from "@/lib/community/validate";
import { abs } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const blocked = guardRead(req);
  if (blocked) return blocked;
  const u = new URL(req.url);
  const t = parseTarget(u.searchParams.get("target"));
  if (!t) return fail(400, "Unknown discussion.");
  const sort = isSort(u.searchParams.get("sort")) ? (u.searchParams.get("sort") as "top" | "new") : "top";
  try {
    if (!(await targetExists(t))) return publicJson({ ok: true, items: [], hasMore: false, total: 0 });
    return publicJson({ ok: true, ...(await listComments(targetKey(t), sort, pageParam(u.searchParams.get("page"), PAGE_MAX))) });
  } catch (e) {
    console.error(`community: comments read failed: ${logSafe(e)}`);
    return fail(500, "Comments didn't load. Please try again in a minute.");
  }
}

export async function POST(req: Request) {
  const g = await guardWrite(req);
  if ("res" in g) return g.res;
  const m = await requireMember(req);
  if ("res" in m) return m.res;
  const l1 = limiters.post.hit(m.user.id);
  const l2 = l1.ok ? limiters.postIp.hit(clientIp(req.headers)) : l1;
  if (!l2.ok) return tooMany(l2.retryAfterS, "That's a lot of posts in a short time");

  const parsed = commentInput.safeParse(g.body);
  if (!parsed.success) return fail(400, firstError(parsed.error));
  const t = parseTarget(parsed.data.target)!;
  const target = targetKey(t);
  try {
    if ((await recentPosts(m.user.id, POST_WINDOW_MIN)) >= POSTS_PER_WINDOW) return tooMany(POST_WINDOW_MIN * 60, "That's a lot of posts in a short time");
    if (!(await targetExists(t))) return fail(404, "That discussion isn't open.");
    let parentId: string | null = null;
    if (parsed.data.parentId) {
      const p = await getComment(parsed.data.parentId);
      if (!p || p.target !== target || p.hidden) return fail(404, "The comment you're replying to is gone.");
      parentId = p.parentId ?? p.id; // one level of replies
    }
    const id = await createComment(m.user.id, target, parentId, parsed.data.body);
    const where = targetLink(target);
    await notifyOwnerBounded("post", `New comment by ${m.user.username}`, [`${m.user.username} commented on ${where.label}:`, parsed.data.body.slice(0, 300), abs(where.href)]);
    return privateJson({ ok: true, comment: { id, createdAt: new Date().toISOString(), editedAt: null, parentId, body: parsed.data.body, deleted: false, score: 0 } }, 201);
  } catch (e) {
    console.error(`community: comment save failed: ${logSafe(e)}`);
    return fail(500, "We couldn't post that just now. Please try again in a minute.");
  }
}
