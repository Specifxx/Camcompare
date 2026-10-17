// /api/alerts/unsubscribe?token=: switch an alert off.
//  - GET: the "Stop this alert" link in every alert email (one click).
//  - POST: the manage page's Remove buttons (a plain form: token, optional
//    all=1, optional back=<manage token>) and mail clients' RFC 8058
//    one-click unsubscribe (List-Unsubscribe-Post), token in the query.
import { isToken, unsubscribeByToken } from "@/lib/alerts";
import { logSafe } from "@/lib/feedback";
import { abs } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRIVATE = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
const go = (path: string) => new Response(null, { status: 303, headers: { ...PRIVATE, Location: abs(path) } });

async function stop(token: string | null, all: boolean, back: string | null): Promise<Response> {
  if (!isToken(token)) return go("/alerts/manage?error=link");
  try {
    const a = await unsubscribeByToken(token, all);
    if (!a) return go("/alerts/manage?error=link");
    return go(`/alerts/manage?token=${isToken(back) ? back : token}&done=${all ? "removed-all" : "removed"}`);
  } catch (e) {
    console.error(`alerts: unsubscribe failed: ${logSafe(e)}`);
    return go("/alerts/manage?error=down");
  }
}

export async function GET(req: Request) {
  return stop(new URL(req.url).searchParams.get("token"), false, null);
}

export async function POST(req: Request) {
  const q = new URL(req.url).searchParams;
  let form: FormData | null = null;
  try {
    const ct = (req.headers.get("content-type") ?? "").toLowerCase();
    if (ct.startsWith("application/x-www-form-urlencoded") || ct.startsWith("multipart/form-data")) form = await req.formData();
  } catch {
    form = null;
  }
  const field = (k: string) => (typeof form?.get(k) === "string" ? (form!.get(k) as string) : null);
  return stop(field("token") ?? q.get("token"), field("all") === "1", field("back"));
}
