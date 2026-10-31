// POST /api/report: "Report a wrong price" (under every product's prices) and
// "Suggest a store" (/contact). Filed in the private reports repo shared by every
// Compare Empire site (src/lib/reports-github.ts), and, as the feedback form
// does, saved to the private feedback table and emailed to CONTACT_EMAIL
// (capped a day). The visitor gives no email; nothing about them is kept.
import { handleReportPost, type Report } from "@/lib/reports-github";
import { feedbackConfigured, saveFeedback } from "@/lib/feedback";
import { notifyOwnerBounded } from "@/lib/community/notify";
import { CONTACT_EMAIL } from "@/lib/site";
import { MARKET_CODES, type MarketCode } from "@/lib/markets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The report as one feedback message, for the admin page and the email. */
function reportMessage(r: Report): string {
  const lines =
    r.kind === "suggest-store"
      ? [`Store suggestion: ${r.store ?? "?"}${r.storeUrl ? ` (${r.storeUrl})` : ""}${r.region ? `, ${r.region}` : ""}`]
      : [`Wrong price: ${r.product ?? r.page ?? "?"}`, `Store: ${r.store ?? "not said"}${r.shown ? `, we showed ${r.shown}` : ""}${r.actual ? `, they say ${r.actual}` : ""}`, `Problem: ${r.issue ?? "not said"}`];
  return [...lines, r.note ? `Note: ${r.note}` : ""].filter(Boolean).join("\n");
}

async function alsoSave(r: Report): Promise<boolean> {
  const message = reportMessage(r);
  const market = (MARKET_CODES as readonly string[]).includes(String(r.region).toLowerCase()) ? (String(r.region).toLowerCase() as MarketCode) : null;
  let saved = false;
  if (feedbackConfigured()) {
    try {
      await saveFeedback({ kind: r.kind === "wrong-price" ? "price" : "other", message, email: null, page: r.page, market, userAgent: null });
      saved = true;
    } catch {
      saved = false;
    }
  }
  await notifyOwnerBounded("feedback", message.split("\n")[0]!.slice(0, 90), [message, r.page ? `Page: ${r.page}` : ""].filter(Boolean));
  return saved;
}

export function POST(req: Request) {
  return handleReportPost(req, "camcompare", { email: CONTACT_EMAIL, also: alsoSave });
}
