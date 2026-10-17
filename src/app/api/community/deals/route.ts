// GET /api/community/deals?keys=a,b,c: vote scores for up to 100 deal keys in
// one request, so the home deal feed makes one call for every card
// (components/community/DealVotes.tsx batches them). Public, CDN-cached 30 s.
// Unknown or malformed keys are skipped; keys nobody voted on score 0.
import { dealScores } from "@/lib/community/db";
import { fail, guardRead, logSafe, publicJson } from "@/lib/community/http";
import { parseDealKeys } from "@/lib/community/rules";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const blocked = guardRead(req);
  if (blocked) return blocked;
  const keys = parseDealKeys(new URL(req.url).searchParams.get("keys"));
  try {
    return publicJson({ ok: true, scores: await dealScores(keys) });
  } catch (e) {
    console.error(`community: deal scores failed: ${logSafe(e)}`);
    return fail(500, "Scores didn't load.");
  }
}
