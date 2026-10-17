"use client";
// "Track this price": an email price alert for one product in one market
// (POST /api/alerts, lib/alerts.ts). No account: the address gets a confirm
// email, and every alert email carries its own stop and manage links.
// Renders a button, and under it (full width in a flex-wrap row) the form.
import { useId, useRef, useState } from "react";
import { ALERT_CONDITIONS, CONDITION_LABEL, parseTarget, suggestTarget, type AlertCondition } from "@/lib/alert-kinds";
import { EMAIL_MAX } from "@/lib/feedback-kinds";
import { price } from "@/lib/format";
import { MARKETS, type MarketCode } from "@/lib/markets";

const field =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-fg placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 sm:text-sm";

type Status = { phase: "idle" | "sending" | "offline" } | { phase: "done"; confirm: boolean } | { phase: "error"; error: string };

export default function PriceAlert({
  slug,
  kind,
  market,
  newPrice,
  usedPrice,
}: {
  slug: string;
  kind: "camera" | "lens";
  market: MarketCode;
  /** Today's lowest new and used price (minor units), from lowest(): Amazon left out, as the alert check does. */
  newPrice: number | null;
  usedPrice: number | null;
}) {
  const id = useId();
  const cur = MARKETS[market].currency;
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [condition, setCondition] = useState<AlertCondition>("any");
  const today = (c: AlertCondition) => (c === "new" ? newPrice : c === "used" ? usedPrice : [newPrice, usedPrice].filter((p): p is number => p !== null).sort((a, b) => a - b)[0] ?? null);
  const fmt = (minor: number | null) => (minor === null ? "" : String(minor / 100));
  const [target, setTarget] = useState(() => fmt(suggestTarget(today("any"))));
  const [touched, setTouched] = useState(false);
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const openedAt = useRef(0);

  const pick = (c: AlertCondition) => {
    setCondition(c);
    if (!touched) setTarget(fmt(suggestTarget(today(c))));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = parseTarget(target);
    if (Number.isNaN(t)) return setStatus({ phase: "error", error: "Type the target as a number, like 1899, or leave it empty for any drop." });
    setStatus({ phase: "sending" });
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), slug, kind, market, condition, target: t, elapsedMs: Date.now() - openedAt.current, website }),
      });
      if (res.status === 503) return setStatus({ phase: "offline" });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; confirm?: boolean };
      if (!res.ok || !d.ok) return setStatus({ phase: "error", error: d.error ?? "Something went wrong. Please try again." });
      setStatus({ phase: "done", confirm: Boolean(d.confirm) });
    } catch {
      setStatus({ phase: "error", error: "Couldn't reach the site. Check your connection and try again." });
    }
  };

  const now = today(condition);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => {
          if (!open) openedAt.current = Date.now();
          setOpen(!open);
        }}
        className="btn-ghost"
      >
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        Track this price
      </button>
      {open && (
        <div id={`${id}-panel`} className="card w-full basis-full p-4">
          {status.phase === "done" ? (
            <div role="status" className="space-y-1 text-sm">
              <p className="font-semibold">{status.confirm ? "Check your inbox" : "Alert saved"}</p>
              <p className="text-muted">
                {status.confirm
                  ? "We've sent a link to confirm your address. Alerts start once you click it."
                  : "We'll email you when the price drops. Every email has a link to stop or change your alerts."}
              </p>
            </div>
          ) : status.phase === "offline" ? (
            <p role="status" className="text-sm text-muted">
              Price alerts aren&apos;t switched on yet. Use Save to keep it on your list for now.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-3" noValidate>
              <p className="text-sm">
                Get an email when the price drops in {MARKETS[market].name}. No account needed.
              </p>
              <label className="block">
                <span className="text-sm font-semibold">Email</span>
                <input type="email" name="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={EMAIL_MAX} placeholder="you@example.com" className={`${field} mt-1`} />
              </label>
              <fieldset>
                <legend className="text-sm font-semibold">Condition</legend>
                <div className="mt-1 flex flex-wrap gap-2">
                  {ALERT_CONDITIONS.map((c) => (
                    <label key={c} className={`btn-ghost cursor-pointer text-xs ${condition === c ? "border-accent text-accent" : ""}`}>
                      <input type="radio" name={`${id}-cond`} value={c} checked={condition === c} onChange={() => pick(c)} className="sr-only" />
                      {CONDITION_LABEL[c]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="block">
                <span className="text-sm font-semibold">
                  Tell me when it&apos;s at or under <span className="font-normal text-subtle">({cur}, optional: empty means any drop)</span>
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  name="target"
                  value={target}
                  onChange={(e) => {
                    setTouched(true);
                    setTarget(e.target.value);
                  }}
                  placeholder="Any drop"
                  className={`${field} mt-1 font-mono`}
                />
                <span className="mt-0.5 block text-xs text-subtle">{now !== null ? `Lowest today: ${price(now, cur)}` : "No price here yet: we'll email you when one appears under your target."}</span>
              </label>
              <div className="hidden" aria-hidden="true">
                <label>
                  Website
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </label>
              </div>
              {status.phase === "error" && (
                <p role="alert" className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-fg">
                  {status.error}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={status.phase === "sending" || !email.trim()} className="btn-primary disabled:opacity-60">
                  {status.phase === "sending" ? "Saving…" : "Email me"}
                </button>
                <span className="text-[11px] text-subtle">At most one email a day per alert. See our privacy page.</span>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}
