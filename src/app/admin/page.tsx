// The owner's page: every feedback message, and the site's state from its
// data files. Reached through the link /admin/<ADMIN_KEY> (./[key]/route.ts),
// which sets the cookie this page checks; without it, a 404 like any unknown
// URL. Never in the sitemap, Disallowed in robots.txt, noindex here too.
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ADMIN_COOKIE, ADMIN_LIST_MAX, adminSessionValid, feedbackConfigured, feedbackCounts, listFeedback, logSafe, type FeedbackRow } from "@/lib/feedback";
import { FEEDBACK_KINDS, KIND_LABEL, type FeedbackKind } from "@/lib/feedback-kinds";
import { isMarket, MARKETS } from "@/lib/markets";
import { allMarketStatus, catalogStatus, envStatus } from "./status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

const isKind = (k: unknown): k is FeedbackKind => typeof k === "string" && (FEEDBACK_KINDS as readonly string[]).includes(k);

function when(iso: string | null): string {
  if (!iso) return "never";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const mins = Math.round((Date.now() - t) / 60_000);
  const ago = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : mins < 48 * 60 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} days ago`;
  return `${new Date(t).toISOString().slice(0, 16).replace("T", " ")} UTC (${ago})`;
}

const STATUS_STYLE: Record<string, string> = { ok: "text-win", skipped: "text-subtle", error: "text-warn font-semibold" };

async function loadFeedback(kind: FeedbackKind | undefined): Promise<{ rows: FeedbackRow[]; counts: Record<string, number>; error?: string }> {
  if (!feedbackConfigured()) return { rows: [], counts: {}, error: "DATABASE_URL isn't set on Vercel, so feedback can't be stored or read yet." };
  try {
    const [rows, counts] = await Promise.all([listFeedback(kind), feedbackCounts()]);
    return { rows, counts };
  } catch (e) {
    console.error(`admin: feedback read failed: ${logSafe(e)}`);
    return { rows: [], counts: {}, error: "The feedback database didn't answer. Try reloading in a minute." };
  }
}

export default async function AdminPage({ searchParams }: { searchParams: { kind?: string | string[] } }) {
  if (!adminSessionValid(cookies().get(ADMIN_COOKIE)?.value)) notFound();
  const kind = isKind(searchParams.kind) ? searchParams.kind : undefined;
  const { rows, counts, error } = await loadFeedback(kind);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const shownOf = kind ? counts[kind] ?? 0 : total;
  const catalog = catalogStatus();
  const markets = allMarketStatus();
  const env = envStatus();

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-muted">
          Only people with your admin link can see this page. This browser stays signed in for 30 days; open the link again on another device.
        </p>
      </header>

      <section aria-labelledby="fb">
        <h2 id="fb" className="h-section">
          Feedback <span className="font-normal text-muted">({total})</span>
        </h2>
        <nav aria-label="Filter by kind" className="mt-3 flex flex-wrap gap-2 text-sm">
          <a href="/admin" className={`chip no-underline ${!kind ? "border-accent text-fg" : ""}`}>All {total}</a>
          {FEEDBACK_KINDS.map((k) => (
            <a key={k} href={`/admin?kind=${k}`} className={`chip no-underline ${kind === k ? "border-accent text-fg" : ""}`}>
              {KIND_LABEL[k]} {counts[k] ?? 0}
            </a>
          ))}
        </nav>
        {error && <p className="mt-4 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm">{error}</p>}
        {!error && !rows.length && <p className="mt-4 text-sm text-muted">No feedback{kind ? ` of this kind` : ""} yet.</p>}
        {shownOf > rows.length && <p className="mt-3 text-xs text-subtle">Showing the newest {ADMIN_LIST_MAX} of {shownOf}.</p>}
        <ol className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span className="chip">{isKind(r.kind) ? KIND_LABEL[r.kind] : r.kind}</span>
                <span>{when(r.createdAt)}</span>
                {r.market && <span>{isMarket(r.market) ? `${MARKETS[r.market].flag} ${MARKETS[r.market].short}` : r.market}</span>}
                {r.page && r.page.startsWith("/") && !r.page.startsWith("//") && (
                  <a href={r.page} rel="noreferrer" className="break-all font-mono">
                    {r.page}
                  </a>
                )}
                <span className="text-subtle">#{r.id}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{r.message}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {r.email ? (
                  <a href={`mailto:${r.email}?subject=${encodeURIComponent("Your CamCompare feedback")}`} className="font-semibold">
                    Reply to {r.email}
                  </a>
                ) : (
                  <span className="text-subtle">No email given</span>
                )}
                {r.userAgent && <span className="break-all text-subtle">{r.userAgent}</span>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="site">
        <h2 id="site" className="h-section">Site status</h2>
        <p className="mt-1 text-sm text-muted">From this deployment&apos;s data files. The daily price import commits new ones, and each commit is a new build.</p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="card p-3">
            <dt className="text-xs text-subtle">Cameras published</dt>
            <dd className="text-xl font-bold">
              {catalog.cameras} <span className="text-sm font-normal text-muted">of {catalog.cameraFiles} files</span>
            </dd>
          </div>
          <div className="card p-3">
            <dt className="text-xs text-subtle">Lenses published</dt>
            <dd className="text-xl font-bold">
              {catalog.lenses} <span className="text-sm font-normal text-muted">of {catalog.lensFiles} files</span>
            </dd>
          </div>
          <div className="card p-3 sm:col-span-2">
            <dt className="text-xs text-subtle">Last price import</dt>
            <dd className="font-semibold">{when(markets.map((m) => m.generatedAt).filter((g): g is string => Boolean(g)).sort().at(-1) ?? null)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-subtle">A product without a thumbnail and a photo credit isn&apos;t published.</p>

        <h3 className="mt-6 font-semibold">Vercel variables</h3>
        <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {env.map((g) => (
            <li key={g.label} className="flex justify-between gap-3 border-b border-line py-1">
              <span>{g.label}</span>
              <span className={g.set === g.of ? "text-win" : g.set ? "text-fg" : "text-subtle"}>{g.of === 1 ? (g.set ? "set" : "not set") : `${g.set} of ${g.of}`}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-subtle">GitHub secrets (feeds, API keys) aren&apos;t visible here: each source&apos;s last run below shows whether they work.</p>
      </section>

      {markets.map((m) => (
        <section key={m.market} aria-labelledby={`m-${m.market}`}>
          <h2 id={`m-${m.market}`} className="h-section">
            {MARKETS[m.market].flag} {MARKETS[m.market].name}
          </h2>
          {m.error ? (
            <p className="mt-2 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm">data/offers/{m.market}.json couldn&apos;t be read: {m.error}</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">
                {m.offers} offers for {m.products} products · imported {when(m.generatedAt)} · {m.historyDays} days of price history
                {m.lastHistoryDay ? ` (last ${m.lastHistoryDay})` : ""}
                {m.amazonOffers ? ` · ${m.amazonOffers} Amazon prices in this build` : ""}
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[40rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-subtle">
                      <th className="py-1.5 pr-3 font-medium">Retailer</th>
                      <th className="py-1.5 pr-3 font-medium">Source</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Offers now</th>
                      <th className="py-1.5 pr-3 font-medium">Last run</th>
                      <th className="py-1.5 pr-3 font-medium">Note</th>
                      <th className="py-1.5 font-medium">Link earns</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.retailers.map((r) => (
                      <tr key={r.key} className="border-b border-line align-top">
                        <td className="py-1.5 pr-3 font-medium">{r.name}</td>
                        <td className="py-1.5 pr-3 text-muted">{r.source}</td>
                        <td className="price py-1.5 pr-3 text-right">{r.offers}</td>
                        <td className="py-1.5 pr-3">
                          {r.run ? (
                            <>
                              <span className={STATUS_STYLE[r.run.status] ?? ""}>{r.run.status}</span>
                              <span className="block text-xs text-subtle">{r.run.offers} offers, {when(r.run.at)}</span>
                            </>
                          ) : (
                            <span className="text-subtle">never run</span>
                          )}
                        </td>
                        <td className="max-w-xs break-words py-1.5 pr-3 text-xs text-muted">{r.run?.note ?? ""}</td>
                        <td className="py-1.5">{r.paid ? <span className="text-win">yes</span> : <span className="text-subtle">no</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ))}
    </div>
  );
}
