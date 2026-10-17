// The owner's link: /admin/<ADMIN_KEY>. The right key sets a cookie and
// redirects to /admin, which shows the page. Any other key, or no ADMIN_KEY
// on Vercel, is a 404. Anyone holding the link gets in (the owner asked for
// exactly that); the key just never stays in the address bar, where
// analytics and ad scripts on the page could read it and Google's ad crawler
// would then fetch it.
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE, adminKeyMatches, adminSessionToken } from "@/lib/feedback";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRIVATE = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };

export function GET(req: Request, { params }: { params: { key: string } }) {
  const token = adminSessionToken();
  if (!token || !adminKeyMatches(params.key)) return new Response("Not found", { status: 404, headers: { ...PRIVATE, "Content-Type": "text/plain; charset=utf-8" } });
  const url = new URL(req.url);
  const res = NextResponse.redirect(new URL("/admin", url), 303);
  // Lax, not Strict: a click on the link in an email is a cross-site
  // navigation, and Strict would drop the cookie on the redirect it lands on.
  res.cookies.set(ADMIN_COOKIE, token, { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/admin", maxAge: ADMIN_COOKIE_MAX_AGE });
  for (const [k, v] of Object.entries(PRIVATE)) res.headers.set(k, v);
  return res;
}
