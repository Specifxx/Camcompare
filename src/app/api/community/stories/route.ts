// GET  /api/community/stories?sort=top|new&page=1&tag=<tag>&product=<slug>&limit=5
//      Public, CDN-cached 30 s: member stories, featured first. With
//      product, the stories that name it (the product page's "Member stories").
// POST /api/community/stories {title, body, verdict?, cover?, tags, products}:
//      a signed-in member's new story. The owner is told (bounded).
import { product } from "@/lib/catalog";
import { recentPosts } from "@/lib/community/db";
import { clientIp, fail, guardRead, guardWrite, limiters, logSafe, pageParam, POST_WINDOW_MIN, POSTS_PER_WINDOW, privateJson, publicJson, requireMember, tooMany } from "@/lib/community/http";
import { notifyOwnerBounded } from "@/lib/community/notify";
import { isSort, PAGE_MAX, PAGE_SIZE, SLUG_RE } from "@/lib/community/rules";
import { isStoryTag, PRODUCT_STORIES_MAX, STORIES_PER_DAY, storyExcerpt, storyPath } from "@/lib/community/stories";
import { createStory, knownProducts, listStories, storiesToday } from "@/lib/community/stories-db";
import { firstError, storyInput } from "@/lib/community/validate";
import { abs } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const blocked = guardRead(req);
  if (blocked) return blocked;
  const u = new URL(req.url);
  const tag = u.searchParams.get("tag");
  const slug = u.searchParams.get("product");
  if (tag && !isStoryTag(tag)) return fail(400, "Unknown tag.");
  if (slug && !SLUG_RE.test(slug)) return fail(400, "Unknown product.");
  const sort = isSort(u.searchParams.get("sort")) ? (u.searchParams.get("sort") as "top" | "new") : "top";
  const limit = slug ? PRODUCT_STORIES_MAX : PAGE_SIZE;
  try {
    if (slug && !product(slug)) return publicJson({ ok: true, items: [], hasMore: false });
    return publicJson({ ok: true, ...(await listStories({ sort, page: pageParam(u.searchParams.get("page"), PAGE_MAX), tag: isStoryTag(tag) ? tag : null, product: slug, limit })) });
  } catch (e) {
    console.error(`community: stories read failed: ${logSafe(e)}`);
    return fail(500, "Stories didn't load. Please try again in a minute.");
  }
}

export async function POST(req: Request) {
  const g = await guardWrite(req, 80_000);
  if ("res" in g) return g.res;
  const m = await requireMember(req);
  if ("res" in m) return m.res;
  const l1 = limiters.post.hit(m.user.id);
  const l2 = l1.ok ? limiters.postIp.hit(clientIp(req.headers)) : l1;
  if (!l2.ok) return tooMany(l2.retryAfterS, "That's a lot of posts in a short time");
  const parsed = storyInput.safeParse(g.body);
  if (!parsed.success) return fail(400, firstError(parsed.error));
  const s = parsed.data;
  const known = knownProducts(s.products);
  if (!known.ok) return fail(400, `We don't list "${known.slug}". Pick products from the search.`);
  try {
    if ((await recentPosts(m.user.id, POST_WINDOW_MIN)) >= POSTS_PER_WINDOW) return tooMany(POST_WINDOW_MIN * 60, "That's a lot of posts in a short time");
    if ((await storiesToday(m.user.id)) >= STORIES_PER_DAY) return tooMany(3600, `That's ${STORIES_PER_DAY} stories today`);
    const id = await createStory(m.user.id, { title: s.title, body: s.body, verdict: s.verdict || null, cover: s.cover, tags: s.tags, products: s.products });
    await notifyOwnerBounded("post", `New story by ${m.user.username}`, [
      `${m.user.username} posted the story "${s.title}" (${s.tags.join(", ")}):`,
      storyExcerpt(s.body, 300),
      s.cover ? `Cover image (shown only if you feature it): ${s.cover}` : "",
      `It is noindex until you feature it on the admin page. ${abs(storyPath(id))}`,
    ].filter(Boolean));
    return privateJson({ ok: true, id }, 201);
  } catch (e) {
    console.error(`community: story save failed: ${logSafe(e)}`);
    return fail(500, "We couldn't post that just now. Please try again in a minute.");
  }
}
