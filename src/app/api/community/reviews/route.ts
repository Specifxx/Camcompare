// GET  /api/community/reviews?product=<slug>&sort=top|new&page=1: public,
//      CDN-cached 30 s: reviews plus the star summary (count, average, histogram).
// POST /api/community/reviews {product, rating 1-5, body}: one review per
//      member per product; posting again replaces your review.
import { product } from "@/lib/catalog";
import { listReviews, recentPosts, upsertReview } from "@/lib/community/db";
import { clientIp, fail, guardRead, guardWrite, limiters, logSafe, pageParam, POST_WINDOW_MIN, POSTS_PER_WINDOW, privateJson, publicJson, requireMember, tooMany } from "@/lib/community/http";
import { notifyOwnerBounded } from "@/lib/community/notify";
import { isSort, PAGE_MAX, SLUG_RE } from "@/lib/community/rules";
import { targetLink } from "@/lib/community/targets";
import { firstError, reviewInput } from "@/lib/community/validate";
import { abs } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const blocked = guardRead(req);
  if (blocked) return blocked;
  const u = new URL(req.url);
  const slug = u.searchParams.get("product") ?? "";
  if (!SLUG_RE.test(slug) || !product(slug)) return fail(400, "Unknown product.");
  const sort = isSort(u.searchParams.get("sort")) ? (u.searchParams.get("sort") as "top" | "new") : "top";
  try {
    return publicJson({ ok: true, ...(await listReviews(slug, sort, pageParam(u.searchParams.get("page"), PAGE_MAX))) });
  } catch (e) {
    console.error(`community: reviews read failed: ${logSafe(e)}`);
    return fail(500, "Reviews didn't load. Please try again in a minute.");
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
  const parsed = reviewInput.safeParse(g.body);
  if (!parsed.success) return fail(400, firstError(parsed.error));
  const { product: slug, rating, body } = parsed.data;
  if (!product(slug)) return fail(404, "We couldn't find that product.");
  try {
    if ((await recentPosts(m.user.id, POST_WINDOW_MIN)) >= POSTS_PER_WINDOW) return tooMany(POST_WINDOW_MIN * 60, "That's a lot of posts in a short time");
    const r = await upsertReview(m.user.id, slug, rating, body);
    if (r.created) {
      const where = targetLink(`product:${slug}`);
      await notifyOwnerBounded("post", `New review by ${m.user.username}`, [`${m.user.username} gave ${where.label} ${rating}/5:`, body.slice(0, 300), abs(where.href)]);
    }
    return privateJson({ ok: true, id: r.id, created: r.created }, r.created ? 201 : 200);
  } catch (e) {
    console.error(`community: review save failed: ${logSafe(e)}`);
    return fail(500, "We couldn't save that just now. Please try again in a minute.");
  }
}
