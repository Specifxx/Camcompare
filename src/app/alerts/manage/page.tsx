// /alerts/manage?token=: every price alert for the address a token belongs to,
// each with a Remove button. The token is the only key (no accounts), so the
// page is dynamic, noindex and sends no referrer.
import type { Metadata } from "next";
import Link from "next/link";
import { ALERT_CONDITION_LABEL } from "@/lib/alert-kinds";
import { alertsForToken, describeAlert, isToken, type AlertRow } from "@/lib/alerts";
import { displayName, product } from "@/lib/catalog";
import { logSafe } from "@/lib/feedback";
import { MARKETS, marketPath } from "@/lib/markets";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your price alerts",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

const NOTICE: Record<string, string> = {
  confirmed: "Thanks, your address is confirmed. We'll email you when a price you're tracking drops.",
  removed: "Done: that alert is off. You won't get emails for it again.",
  "removed-all": "Done: every alert for this address is off.",
};
const ERROR: Record<string, string> = {
  link: "That link isn't valid any more. Each alert email has a fresh one.",
  down: "We couldn't reach the alerts database just now. Please try the link again in a minute.",
};

async function load(token: string): Promise<{ owner: AlertRow; alerts: AlertRow[] } | null | "down"> {
  try {
    return await alertsForToken(token);
  } catch (e) {
    console.error(`alerts: manage read failed: ${logSafe(e)}`);
    return "down";
  }
}

export default async function ManageAlerts({ searchParams }: { searchParams: { token?: string; done?: string; error?: string } }) {
  const token = typeof searchParams.token === "string" ? searchParams.token : "";
  const data = isToken(token) ? await load(token) : null;
  const error = data === "down" ? ERROR.down : !data ? ERROR[searchParams.error ?? ""] ?? ERROR.link : null;
  const notice = searchParams.done ? NOTICE[searchParams.done] : null;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Your price alerts</h1>
      {notice && <p className="card p-3 text-sm">{notice}</p>}
      {error && <p className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm">{error}</p>}
      {data && data !== "down" && (
        <>
          <p className="text-sm text-muted">
            Alerts for <span className="font-semibold text-fg">{data.owner.email}</span>
            {data.alerts.some((a) => !a.confirmed) ? " · waiting for you to click the link in the confirm email" : ""}
          </p>
          {data.alerts.length ? (
            <ul className="card divide-y divide-line">
              {data.alerts.map((a) => {
                const p = product(a.product);
                const name = p ? displayName(p.item, a.market) : a.product;
                const href = marketPath(a.market, `/${a.kind === "camera" ? "cameras" : "lenses"}/${a.product}`);
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <Link href={href} className="font-semibold">
                        {name}
                      </Link>
                      <p className="text-xs text-muted">
                        {MARKETS[a.market]?.short ?? a.market} · {ALERT_CONDITION_LABEL[a.condition]} · {describeAlert(a)}
                        {a.confirmed ? "" : " · not confirmed yet"}
                      </p>
                    </div>
                    <form method="post" action="/api/alerts/unsubscribe">
                      <input type="hidden" name="token" value={a.token} />
                      <input type="hidden" name="back" value={token} />
                      <button type="submit" className="btn-ghost">
                        Remove
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="card p-4 text-sm text-muted">No active alerts. Use &ldquo;Track this price&rdquo; on any camera or lens page to add one.</p>
          )}
          {data.alerts.length > 1 && (
            <form method="post" action="/api/alerts/unsubscribe">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="all" value="1" />
              <button type="submit" className="btn-ghost">
                Remove all alerts
              </button>
            </form>
          )}
          <p className="text-xs text-subtle">Keep this link to yourself: anyone with it can see and remove these alerts. We use your email only for these alerts.</p>
        </>
      )}
    </div>
  );
}
