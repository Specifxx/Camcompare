// GET /api/alerts/confirm?token=: the link in the confirm email. Confirms the
// address (every alert waiting for it), then shows the manage page.
import { confirmByToken, isToken } from "@/lib/alerts";
import { logSafe } from "@/lib/feedback";
import { abs } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRIVATE = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
const go = (path: string) => new Response(null, { status: 303, headers: { ...PRIVATE, Location: abs(path) } });

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!isToken(token)) return go("/alerts/manage?error=link");
  try {
    const a = await confirmByToken(token);
    if (!a) return go("/alerts/manage?error=link");
    return go(`/alerts/manage?token=${token}&done=confirmed`);
  } catch (e) {
    console.error(`alerts: confirm failed: ${logSafe(e)}`);
    return go("/alerts/manage?error=down");
  }
}
