// POST /api/community/auth/signout: ends this session server-side and clears its cookies.
import { clearedCookies, hashToken } from "@/lib/community/auth";
import { deleteSession } from "@/lib/community/db";
import { guardWrite, logSafe, secureRequest, sessionToken } from "@/lib/community/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const g = await guardWrite(req, 200, { needAuth: false });
  if ("res" in g) return g.res;
  const raw = sessionToken(req);
  if (raw) await deleteSession(hashToken(raw)).catch((e) => console.error(`community: sign-out failed: ${logSafe(e)}`));
  const headers = new Headers({ "Cache-Control": "private, no-store", "Content-Type": "application/json" });
  for (const c of clearedCookies({ secure: secureRequest(req) })) headers.append("Set-Cookie", c);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
