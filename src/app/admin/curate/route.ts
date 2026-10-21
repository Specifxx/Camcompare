// POST /admin/curate: the owner's story "feature" switch and request status
// buttons on /admin (./stories.tsx). Same guard as ./moderate: the admin
// cookie (scoped to /admin), same origin, plain HTML form posts, 404 to
// anyone else.
import { NextResponse } from "next/server";
import { readCookie, sameOrigin } from "@/lib/community/auth";
import { communityConfigured } from "@/lib/community/db";
import { setFeatured, setRequestStatus } from "@/lib/community/stories-db";
import { featureInput, requestStatusInput } from "@/lib/community/validate";
import { ADMIN_COOKIE, adminSessionValid, logSafe } from "@/lib/feedback";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRIVATE = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
const plain = (status: number, text: string) => new Response(text, { status, headers: { ...PRIVATE, "Content-Type": "text/plain; charset=utf-8" } });

export async function POST(req: Request) {
  if (!adminSessionValid(readCookie(req.headers.get("cookie"), ADMIN_COOKIE))) return plain(404, "Not found");
  if (!sameOrigin(req.headers, req.url)) return plain(403, "Forbidden");
  if (!communityConfigured()) return plain(503, "DATABASE_URL isn't set");
  let fields: Record<string, string> = {};
  try {
    fields = Object.fromEntries([...(await req.formData()).entries()].map(([k, v]) => [k, String(v)]));
  } catch {
    return plain(400, "Bad form");
  }
  let anchor = "stories";
  try {
    if (fields.what === "feature") {
      const p = featureInput.safeParse(fields);
      if (!p.success) return plain(400, "Bad form");
      await setFeatured(p.data.id, p.data.featured);
    } else if (fields.what === "status") {
      const p = requestStatusInput.safeParse(fields);
      if (!p.success) return plain(400, "Bad form");
      await setRequestStatus(p.data.id, p.data.status, p.data.note || null);
      anchor = "requests";
    } else return plain(400, "Bad form");
  } catch (e) {
    console.error(`admin: curate failed (${fields.what}): ${logSafe(e)}`);
    return plain(500, "The database didn't answer. Go back and try again.");
  }
  const res = NextResponse.redirect(new URL(`/admin#${anchor}`, req.url), 303);
  for (const [k, v] of Object.entries(PRIVATE)) res.headers.set(k, v);
  return res;
}
