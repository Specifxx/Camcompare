// GET /api/community/users/<username>: a member's public profile (CamKarma,
// badge, join date, recent comments and reviews). Public, CDN-cached 30 s.
// Never an email or an id. A banned member has no profile.
import { profile } from "@/lib/community/db";
import { fail, guardRead, logSafe, publicJson } from "@/lib/community/http";
import { targetLink } from "@/lib/community/targets";
import { product, productPath } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { username: string } }) {
  const blocked = guardRead(req);
  if (blocked) return blocked;
  let name = params.username;
  try {
    name = decodeURIComponent(name);
  } catch {
    /* as is */
  }
  // Any valid shape (reserved names included, so the lookup simply misses).
  if (!/^[A-Za-z][A-Za-z0-9_]{2,19}$/.test(name)) return fail(404, "No member by that name.");
  try {
    const p = await profile(name.toLowerCase());
    if (!p) return fail(404, "No member by that name.");
    return publicJson({
      ok: true,
      profile: {
        ...p,
        comments: p.comments.map((c) => ({ ...c, ...targetLink(c.target) })),
        reviews: p.reviews.map((r) => {
          const prod = product(r.product);
          return { ...r, href: prod ? `${productPath(prod)}#discussion` : "/", label: prod?.item.name ?? r.product };
        }),
      },
    });
  } catch (e) {
    console.error(`community: profile failed: ${logSafe(e)}`);
    return fail(500, "The profile didn't load. Please try again in a minute.");
  }
}
