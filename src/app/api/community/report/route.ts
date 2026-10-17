// POST /api/community/report {kind, id, reason, note?}: flags a comment, review
// or thread for the owner. Once per member per post. The owner gets an email
// (at most NOTICE_CAPS.report a day); AUTO_HIDE_REPORTS distinct reporters
// hide the post until the owner looks, since the owner isn't always watching.
import { addReport, postAuthor, postSummary, setHidden } from "@/lib/community/db";
import { fail, guardWrite, limiters, logSafe, privateJson, requireMember, tooMany } from "@/lib/community/http";
import { notifyOwnerBounded } from "@/lib/community/notify";
import { AUTO_HIDE_REPORTS, REPORT_REASON_LABEL } from "@/lib/community/rules";
import { targetLink } from "@/lib/community/targets";
import { firstError, reportInput } from "@/lib/community/validate";
import { abs } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const g = await guardWrite(req, 2_000);
  if ("res" in g) return g.res;
  const m = await requireMember(req, { needUsername: false });
  if ("res" in m) return m.res;
  const l = limiters.report.hit(m.user.id);
  if (!l.ok) return tooMany(l.retryAfterS, "That's a lot of reports");
  const parsed = reportInput.safeParse(g.body);
  if (!parsed.success) return fail(400, firstError(parsed.error));
  const { kind, id, reason, note } = parsed.data;
  try {
    const author = await postAuthor(kind, id);
    if (!author) return privateJson({ ok: true }); // already hidden or gone
    if (author === m.user.id) return fail(400, "That's your own post: edit or delete it instead.");
    const r = await addReport(m.user.id, kind, id, reason, note || null);
    if (r.inserted) {
      const autoHidden = r.reporters >= AUTO_HIDE_REPORTS && (await setHidden(kind, id, true));
      const s = await postSummary(kind, id);
      const where = s ? targetLink(s.where) : null;
      await notifyOwnerBounded("report", `Report: ${kind} #${id} (${REPORT_REASON_LABEL[reason]})`, [
        `${m.user.username ?? "A member"} reported a ${kind} by ${s?.username ?? "unknown"}: ${REPORT_REASON_LABEL[reason]}.`,
        note ? `Their note: ${note}` : "",
        s ? `The post: ${s.excerpt}` : "",
        where ? `Where: ${abs(where.href)}` : "",
        autoHidden ? `${r.reporters} members have reported it, so it is hidden until you unhide it.` : `${r.reporters} report(s) so far; ${AUTO_HIDE_REPORTS} hide it automatically.`,
      ].filter(Boolean));
    }
    return privateJson({ ok: true });
  } catch (e) {
    console.error(`community: report failed: ${logSafe(e)}`);
    return fail(500, "We couldn't send that just now. Please try again in a minute.");
  }
}
