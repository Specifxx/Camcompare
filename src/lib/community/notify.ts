// Bounded owner notifications for the community's public forms (CLAUDE.md:
// every new public form tells the owner, and never floods them). The
// feedback form has no notification of its own to copy, so this is the
// pattern: one email per event through Resend (lib/alerts.ts sendEmail), at
// most NOTICE_CAPS[kind] a day (UTC) across every server instance, counted
// in community_notices. Past the cap, events still land on /admin; only the
// email stops until tomorrow. Without OWNER_EMAIL or RESEND_API_KEY it does
// nothing. Never throws: a failed email must not fail the post.
import { emailBody, emailConfigured, sendEmail } from "../alerts";
import { logSafe } from "../feedback";
import { abs } from "../site";
import { bumpNotice } from "./db";

export const NOTICE_CAPS = { report: 20, post: 10, signup: 5 } as const;
export type NoticeKind = keyof typeof NOTICE_CAPS;

export const ownerEmail = () => process.env.OWNER_EMAIL?.trim() || null;

/** Whether the n-th notice of a kind today still gets an email (the last one says the cap was reached). */
export function noticeVerdict(kind: NoticeKind, nth: number): "send" | "send-last" | "skip" {
  const cap = NOTICE_CAPS[kind];
  return nth < cap ? "send" : nth === cap ? "send-last" : "skip";
}

export async function notifyOwnerBounded(kind: NoticeKind, subject: string, lines: string[]): Promise<void> {
  const to = ownerEmail();
  if (!to || !emailConfigured()) return;
  try {
    const verdict = noticeVerdict(kind, await bumpNotice(kind));
    if (verdict === "skip") return;
    const body = emailBody({
      lines: verdict === "send-last" ? [...lines, `That's ${NOTICE_CAPS[kind]} of these today, the daily cap: the rest wait on the admin page until tomorrow.`] : lines,
      button: { label: "Open the admin page", url: abs("/admin#community") },
      footer: ["Sent because OWNER_EMAIL is set on Vercel. The admin page needs your admin link once per browser."],
    });
    await sendEmail({ to, subject: `[CamCompare] ${subject}`, ...body });
  } catch (e) {
    console.error(`community: owner notice failed (${kind}): ${logSafe(e)}`);
  }
}
