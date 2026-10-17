// POST /admin/moderate: the owner's hide / unhide / ban / unban / resolve
// buttons on /admin (the community section). Under /admin, not /api, because
// the admin cookie is scoped to Path=/admin and this must check that same
// cookie. Plain HTML form posts, so the page needs no script: same-origin
// only (Origin), the SameSite=Lax cookie never rides a cross-site POST, and
// it answers 404 like /admin to anyone without the cookie.
import { NextResponse } from "next/server";
import { sameOrigin, readCookie } from "@/lib/community/auth";
import { communityConfigured, resolveReports, setBanned, setHidden } from "@/lib/community/db";
import { moderateInput } from "@/lib/community/validate";
import { ADMIN_COOKIE, adminSessionValid, logSafe } from "@/lib/feedback";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRIVATE = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
const notFound = () => new Response("Not found", { status: 404, headers: { ...PRIVATE, "Content-Type": "text/plain; charset=utf-8" } });

export async function POST(req: Request) {
  if (!adminSessionValid(readCookie(req.headers.get("cookie"), ADMIN_COOKIE))) return notFound();
  if (!sameOrigin(req.headers, req.url)) return new Response("Forbidden", { status: 403, headers: PRIVATE });
  if (!communityConfigured()) return new Response("DATABASE_URL isn't set", { status: 503, headers: PRIVATE });
  let fields: Record<string, string> = {};
  try {
    const form = await req.formData();
    fields = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  } catch {
    return new Response("Bad form", { status: 400, headers: PRIVATE });
  }
  const parsed = moderateInput.safeParse(fields);
  if (!parsed.success) return new Response("Bad form", { status: 400, headers: PRIVATE });
  const { action, kind, id } = parsed.data;
  try {
    if (kind === "user") {
      if (action === "ban" || action === "unban") await setBanned(id, action === "ban");
    } else if (action === "hide" || action === "unhide") {
      await setHidden(kind, id, action === "hide");
      await resolveReports(kind, id);
    } else if (action === "resolve") {
      await resolveReports(kind, id);
    }
  } catch (e) {
    console.error(`admin: moderation failed (${action} ${kind}): ${logSafe(e)}`);
    return new Response("The database didn't answer. Go back and try again.", { status: 500, headers: PRIVATE });
  }
  const res = NextResponse.redirect(new URL("/admin#community", req.url), 303);
  for (const [k, v] of Object.entries(PRIVATE)) res.headers.set(k, v);
  return res;
}
