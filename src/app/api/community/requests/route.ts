// GET  /api/community/requests?sort=top|new&page=1&status=open|planned|done|wont
//      Public, CDN-cached 30 s: the request board.
// POST /api/community/requests {kind, title, body}: a signed-in member's
//      feature or gear request. The owner is told (bounded) and sets its
//      status on /admin.
import { recentPosts } from "@/lib/community/db";
import { clientIp, fail, guardRead, guardWrite, limiters, logSafe, pageParam, POST_WINDOW_MIN, POSTS_PER_WINDOW, privateJson, publicJson, requireMember, tooMany } from "@/lib/community/http";
import { notifyOwnerBounded } from "@/lib/community/notify";
import { isRequestStatus, requestKindLabel, REQUESTS_PER_DAY } from "@/lib/community/requests";
import { isSort, PAGE_MAX } from "@/lib/community/rules";
import { createRequest, listRequests, requestsToday } from "@/lib/community/stories-db";
import { firstError, requestInput } from "@/lib/community/validate";
import { abs } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const blocked = guardRead(req);
  if (blocked) return blocked;
  const u = new URL(req.url);
  const status = u.searchParams.get("status");
  if (status && !isRequestStatus(status)) return fail(400, "Unknown status.");
  const sort = isSort(u.searchParams.get("sort")) ? (u.searchParams.get("sort") as "top" | "new") : "top";
  try {
    return publicJson({ ok: true, ...(await listRequests({ sort, page: pageParam(u.searchParams.get("page"), PAGE_MAX), status: isRequestStatus(status) ? status : null })) });
  } catch (e) {
    console.error(`community: requests read failed: ${logSafe(e)}`);
    return fail(500, "Requests didn't load. Please try again in a minute.");
  }
}

export async function POST(req: Request) {
  const g = await guardWrite(req, 8_000);
  if ("res" in g) return g.res;
  const m = await requireMember(req);
  if ("res" in m) return m.res;
  const l1 = limiters.post.hit(m.user.id);
  const l2 = l1.ok ? limiters.postIp.hit(clientIp(req.headers)) : l1;
  if (!l2.ok) return tooMany(l2.retryAfterS, "That's a lot of posts in a short time");
  const parsed = requestInput.safeParse(g.body);
  if (!parsed.success) return fail(400, firstError(parsed.error));
  const { kind, title, body } = parsed.data;
  try {
    if ((await recentPosts(m.user.id, POST_WINDOW_MIN)) >= POSTS_PER_WINDOW) return tooMany(POST_WINDOW_MIN * 60, "That's a lot of posts in a short time");
    if ((await requestsToday(m.user.id)) >= REQUESTS_PER_DAY) return tooMany(3600, `That's ${REQUESTS_PER_DAY} requests today`);
    const id = await createRequest(m.user.id, kind, title, body);
    await notifyOwnerBounded("post", `New request by ${m.user.username}`, [`${m.user.username} requested (${requestKindLabel(kind)}): "${title}"`, body.slice(0, 300), `Set its status on the admin page. ${abs(`/requests#r${id}`)}`].filter(Boolean));
    return privateJson({ ok: true, id }, 201);
  } catch (e) {
    console.error(`community: request save failed: ${logSafe(e)}`);
    return fail(500, "We couldn't post that just now. Please try again in a minute.");
  }
}
