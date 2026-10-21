// POST /api/alerts: one alert from the "Track this price" form (price drop,
// deal under a price, back in stock, preorder opens) or from /releases
// (preorder for a release, a maker's announcements) into the private
// price_alerts table (lib/alerts.ts). Double opt-in: a new address
// gets a confirm email and nothing else until it clicks. Without DATABASE_URL
// and RESEND_API_KEY it answers 503 and the form says alerts aren't connected.
// Logs never carry the email address or the connection string.
import { alertOrderState, alertsConfigured, alertsLimiter, ALERTS_NOT_CONNECTED, checkAlertRequest, confirmEmail, createAlert, lowestFor, sendEmail } from "@/lib/alerts";
import { ALERTS_PER_EMAIL } from "@/lib/alert-kinds";
import { displayName, offersFor, product } from "@/lib/catalog";
import { clientIp, logSafe } from "@/lib/feedback";
import { releaseBrandName, isReleaseBrand } from "@/lib/releases/brands";
import { releaseById } from "@/lib/releases/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY = 4_000;
const reply = (status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", ...headers } });

export async function POST(req: Request) {
  if (!alertsConfigured()) return reply(503, { ok: false, error: ALERTS_NOT_CONNECTED });
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return reply(415, { ok: false, error: "Send the form as JSON." });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return reply(413, { ok: false, error: "That request is too large." });

  const limit = alertsLimiter.hit(clientIp(req.headers));
  if (!limit.ok) return reply(429, { ok: false, error: "That's a lot of alerts in a short time. Please try again in a few minutes." }, { "Retry-After": String(limit.retryAfterS) });

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return reply(413, { ok: false, error: "That request is too large." });
    body = JSON.parse(text);
  } catch {
    return reply(400, { ok: false, error: "Something in the form isn't right. Please try again." });
  }

  const verdict = checkAlertRequest(body);
  if (verdict.action === "reject") return reply(verdict.status, { ok: false, error: verdict.error });
  if (verdict.action === "drop") return reply(200, { ok: true, confirm: true });
  const a = verdict.alert;
  // The subject must exist in this build: a product, a release in data/releases.json, or a watched maker.
  let name: string;
  if (a.kind === "brand") {
    if (!isReleaseBrand(a.slug)) return reply(400, { ok: false, error: "We don't watch that maker yet." });
    name = releaseBrandName(a.slug);
  } else if (a.kind === "release") {
    const r = releaseById(a.slug);
    if (!r) return reply(400, { ok: false, error: "We couldn't find that announcement." });
    name = r.title.length > 80 ? `${r.title.slice(0, 77)}…` : r.title;
  } else {
    const p = product(a.slug);
    if (!p || p.kind !== a.kind) return reply(400, { ok: false, error: "We couldn't find that product." });
    name = displayName(p.item, a.market);
  }

  try {
    const seen = a.type === "price" ? lowestFor(offersFor(a.slug, a.market), a.condition)?.price ?? null : null;
    const state = a.type === "brand" ? new Date().toISOString() : a.type === "price" ? null : alertOrderState({ ...a, product: a.slug }, (s) => offersFor(s, a.market), (id) => releaseById(id)?.products ?? []);
    const r = await createAlert(a, seen, state);
    if (r.status === "full") return reply(409, { ok: false, error: `You already have ${ALERTS_PER_EMAIL} alerts. Remove one from the link in any alert email first.` });
    if (r.sendConfirm) await sendEmail(confirmEmail(r.row, name));
    return reply(r.status === "created" ? 201 : 200, { ok: true, confirm: !r.row.confirmed, updated: r.status === "updated" });
  } catch (e) {
    console.error(`alerts: save failed (${a.slug}, ${a.market}): ${logSafe(e)}`);
    return reply(500, { ok: false, error: "We couldn't save that just now. Please try again in a minute." });
  }
}
