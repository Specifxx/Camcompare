// GET  /api/community/threads?board=<slug>&sort=top|new&page=1: public,
//      CDN-cached 30 s; without board, every board.
// POST /api/community/threads {board, title, body}: a new discussion thread.
import { createThread, listThreads, recentPosts } from "@/lib/community/db";
import { clientIp, fail, guardRead, guardWrite, limiters, logSafe, pageParam, POST_WINDOW_MIN, POSTS_PER_WINDOW, privateJson, publicJson, requireMember, tooMany } from "@/lib/community/http";
import { notifyOwnerBounded } from "@/lib/community/notify";
import { boardName, isBoard, isSort, PAGE_MAX, threadPath } from "@/lib/community/rules";
import { firstError, threadInput } from "@/lib/community/validate";
import { abs } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const blocked = guardRead(req);
  if (blocked) return blocked;
  const u = new URL(req.url);
  const b = u.searchParams.get("board");
  if (b && !isBoard(b)) return fail(400, "Unknown board.");
  const sort = isSort(u.searchParams.get("sort")) ? (u.searchParams.get("sort") as "top" | "new") : "new";
  try {
    return publicJson({ ok: true, ...(await listThreads(isBoard(b) ? b : null, sort, pageParam(u.searchParams.get("page"), PAGE_MAX))) });
  } catch (e) {
    console.error(`community: threads read failed: ${logSafe(e)}`);
    return fail(500, "Threads didn't load. Please try again in a minute.");
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
  const parsed = threadInput.safeParse(g.body);
  if (!parsed.success) return fail(400, firstError(parsed.error));
  const { board, title, body } = parsed.data;
  try {
    if ((await recentPosts(m.user.id, POST_WINDOW_MIN)) >= POSTS_PER_WINDOW) return tooMany(POST_WINDOW_MIN * 60, "That's a lot of posts in a short time");
    const id = await createThread(m.user.id, board, title, body);
    await notifyOwnerBounded("post", `New thread by ${m.user.username}`, [`${m.user.username} started "${title}" in ${boardName(board)}:`, body.slice(0, 300), abs(threadPath(id))]);
    return privateJson({ ok: true, id }, 201);
  } catch (e) {
    console.error(`community: thread save failed: ${logSafe(e)}`);
    return fail(500, "We couldn't post that just now. Please try again in a minute.");
  }
}
