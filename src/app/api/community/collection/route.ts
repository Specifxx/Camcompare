// GET /api/community/collection: your own My gear list. PUT {items}: replace
// it. Private: per member, never cached, never public, read by nobody else
// (not even /admin). Signed in without a username is fine: nothing is shown
// to anyone.
import { product } from "@/lib/catalog";
import { cleanItems } from "@/lib/collection";
import { createRateLimiter } from "@/lib/feedback";
import { fail, guardWrite, logSafe, privateJson, requireMember, tooMany } from "@/lib/community/http";
import { communityConfigured, COMMUNITY_NOT_CONNECTED } from "@/lib/community/db";
import { readCollection, writeCollection } from "@/lib/community/stories-db";
import { collectionInput, firstError } from "@/lib/community/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const saves = createRateLimiter({ limit: 60, windowMs: 10 * 60_000 });
const known = (slug: string) => product(slug) !== null;

export async function GET(req: Request) {
  if (!communityConfigured()) return fail(503, COMMUNITY_NOT_CONNECTED);
  const m = await requireMember(req, { needUsername: false });
  if ("res" in m) return m.res;
  try {
    const c = await readCollection(m.user.id);
    return privateJson({ ok: true, items: cleanItems(c.items, known), updatedAt: c.updatedAt });
  } catch (e) {
    console.error(`community: collection read failed: ${logSafe(e)}`);
    return fail(500, "Your gear didn't load. Please try again in a minute.");
  }
}

export async function PUT(req: Request) {
  const g = await guardWrite(req, 150_000);
  if ("res" in g) return g.res;
  const m = await requireMember(req, { needUsername: false });
  if ("res" in m) return m.res;
  const l = saves.hit(m.user.id);
  if (!l.ok) return tooMany(l.retryAfterS, "That's a lot of saves in a short time");
  const parsed = collectionInput.safeParse(g.body);
  if (!parsed.success) return fail(400, firstError(parsed.error));
  const items = cleanItems(parsed.data.items, known);
  try {
    await writeCollection(m.user.id, items);
    return privateJson({ ok: true, items });
  } catch (e) {
    console.error(`community: collection save failed: ${logSafe(e)}`);
    return fail(500, "We couldn't save your gear just now. It's still kept in this browser.");
  }
}
