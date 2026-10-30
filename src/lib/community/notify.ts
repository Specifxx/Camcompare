// Bounded owner notifications for the community's public forms (CLAUDE.md:
// every new public form tells the owner, and never floods them). The
// feedback form has no notification of its own to copy, so this is the
// pattern: one email per event through Resend (lib/alerts.ts sendEmail), at
// most NOTICE_CAPS[kind] a day (UTC) across every server instance, counted
// in community_notices. Past the cap, events still land on /admin; only the
// email stops until tomorrow. It goes to CONTACT_EMAIL (lib/site.ts) and does
// nothing without RESEND_API_KEY. Never throws: a failed email must not fail the post.
import { emailBody, emailConfigured, sendEmail } from "../alerts";
import { logSafe } from "../feedback";
import { abs, CONTACT_EMAIL } from "../site";
import { bumpNotice } from "./db";

// feedback: the /feedback form (owner, 2026-10-30: "any feedback feeds into the
// respective emails"), Reply-To the visitor when they left an address.
export const NOTICE_CAPS = { report: 20, post: 10, signup: 5, feedback: 25 } as const;
export type NoticeKind = keyof typeof NOTICE_CAPS;

export const ownerEmail = () => CONTACT_EMAIL;

/** Whether the n-th notice of a kind today still gets an email (the last one says the cap was reached). */
export function noticeVerdict(kind: NoticeKind, nth: number): "send" | "send-last" | "skip" {
  const cap = NOTICE_CAPS[kind];
  return nth < cap ? "send" : nth === cap ? "send-last" : "skip";
}

export async function notifyOwnerBounded(kind: NoticeKind, subject: string, lines: string[], replyTo?: string | null): Promise<void> {
  const to = ownerEmail();
  if (!to || !emailConfigured()) return;
  try {
    const verdict = noticeVerdict(kind, await bumpNotice(kind));
    if (verdict === "skip") return;
    const body = emailBody({
      lines: verdict === "send-last" ? [...lines, `That's ${NOTICE_CAPS[kind]} of these today, the daily cap: the rest wait on the admin page until tomorrow.`] : lines,
      button: { label: "Open the admin page", url: abs("/admin#community") },
      footer: [`Sent to ${CONTACT_EMAIL}, CamCompare's contact address. The admin page needs your admin link once per browser.`],
    });
    await sendEmail({ to, subject: `[CamCompare] ${subject}`, ...body, ...(replyTo ? { replyTo } : {}) });
  } catch (e) {
    console.error(`community: owner notice failed (${kind}): ${logSafe(e)}`);
  }
}
