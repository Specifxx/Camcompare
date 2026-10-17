// POST /api/feedback: one message from the feedback form into the private
// feedback table (lib/feedback.ts). JSON in, JSON out. Without DATABASE_URL
// it answers 503 and the form says feedback isn't connected yet.
// Logs never carry what the visitor wrote, their email or the connection string.
import { checkSubmission, clientIp, feedbackConfigured, feedbackLimiter, logSafe, NOT_CONNECTED, saveFeedback } from "@/lib/feedback";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Far above a 4,000-character message in JSON; anything bigger isn't from the form. */
const MAX_BODY = 20_000;

const reply = (status: number, body: { ok: boolean; error?: string }, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function POST(req: Request) {
  if (!feedbackConfigured()) return reply(503, { ok: false, error: NOT_CONNECTED });
  // JSON only: another site's plain HTML form can't send this content type
  // without a CORS preflight, which this route never answers.
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return reply(415, { ok: false, error: "Send the form as JSON." });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return reply(413, { ok: false, error: "That message is too long." });

  const limit = feedbackLimiter.hit(clientIp(req.headers));
  if (!limit.ok) return reply(429, { ok: false, error: "You've sent a lot of feedback in a short time. Please try again in a few minutes." }, { "Retry-After": String(limit.retryAfterS) });

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return reply(413, { ok: false, error: "That message is too long." });
    body = JSON.parse(text);
  } catch {
    return reply(400, { ok: false, error: "Something in the form isn't right. Please try again." });
  }

  const verdict = checkSubmission(body, req.headers.get("user-agent"));
  if (verdict.action === "reject") return reply(verdict.status, { ok: false, error: verdict.error });
  if (verdict.action === "drop") return reply(200, { ok: true });

  try {
    await saveFeedback(verdict.row);
  } catch (e) {
    console.error(`feedback: save failed (${verdict.row.kind}, ${verdict.row.message.length} chars): ${logSafe(e)}`);
    return reply(500, { ok: false, error: "We couldn't save that just now. Please try again in a minute." });
  }
  return reply(201, { ok: true });
}
