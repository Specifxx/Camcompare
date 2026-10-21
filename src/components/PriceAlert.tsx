"use client";
// "Track this price": an email alert for one product in one market
// (POST /api/alerts, lib/alerts.ts). Four kinds, Google Shopping style:
// any price drop, only deals under a price, back in stock, preorder opens.
// No account: the address gets a confirm email, and every alert email
// carries its own stop and manage links.
// Renders a button, and under it (full width in a flex-wrap row) the form.
// PriceHistory.tsx opens it by the button's label: keep "Track this price".
import { useId, useRef, useState } from "react";
import { ALERT_CONDITIONS, ALERT_CONDITION_LABEL, modeType, parseTarget, PRODUCT_ALERT_MODE, PRODUCT_ALERT_MODES, suggestTarget, type AlertCondition, type ProductAlertMode } from "@/lib/alert-kinds";
import { EMAIL_MAX } from "@/lib/feedback-kinds";
import { price } from "@/lib/format";
import { MARKETS, type MarketCode } from "@/lib/markets";
import { ORDER_STATE_LABEL, type OrderState } from "@/lib/releases/stock";
import { alertField as field, postAlert, type AlertStatus } from "./alert-post";

const DONE: Record<ProductAlertMode, string> = {
  drop: "We'll email you when the price drops.",
  under: "We'll email you when it's at or under your price.",
  restock: "We'll email you when a store has it in stock again.",
  preorder: "We'll email you the moment a store takes orders.",
};

export default function PriceAlert({
  slug,
  kind,
  market,
  newPrice,
  usedPrice,
  state,
}: {
  slug: string;
  kind: "camera" | "lens";
  market: MarketCode;
  /** Today's lowest new and used price (minor units), from lowest(): Amazon left out, as the alert check does. */
  newPrice: number | null;
  usedPrice: number | null;
  /** Today's order state at stores (lib/releases/stock.ts orderState), when the page knows it: picks the useful default. */
  state?: OrderState;
}) {
  const id = useId();
  const cur = MARKETS[market].currency;
  const priced = newPrice !== null || usedPrice !== null;
  // Nothing in stock: a restock (or, never listed, a preorder) alert is the useful one.
  const initialMode: ProductAlertMode = state === "none" || (!priced && !state) ? "preorder" : state === "out" || state === "backorder" ? "restock" : "drop";
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<ProductAlertMode>(initialMode);
  const [condition, setCondition] = useState<AlertCondition>("any");
  const today = (c: AlertCondition) => (c === "new" ? newPrice : c === "used" ? usedPrice : [newPrice, usedPrice].filter((p): p is number => p !== null).sort((a, b) => a - b)[0] ?? null);
  const fmt = (minor: number | null) => (minor === null ? "" : String(minor / 100));
  const [target, setTarget] = useState(() => fmt(suggestTarget(today("any"))));
  const [touched, setTouched] = useState(false);
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<AlertStatus>({ phase: "idle" });
  const openedAt = useRef(0);

  const pick = (c: AlertCondition) => {
    setCondition(c);
    if (!touched) setTarget(fmt(suggestTarget(today(c))));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let t: number | null = null;
    if (mode === "under") {
      t = parseTarget(target);
      if (t === null || Number.isNaN(t)) return setStatus({ phase: "error", error: "Type your price as a number, like 1899." });
    }
    setStatus({ phase: "sending" });
    setStatus(await postAlert({ email, slug, kind, market, type: modeType(mode), condition: mode === "preorder" ? "new" : condition, target: t, elapsedMs: Date.now() - openedAt.current, website }));
  };

  const now = today(condition);
  const showCondition = mode !== "preorder";
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
              <p className="text-muted">{status.confirm ? "We've sent a link to confirm your address. Alerts start once you click it." : `${DONE[mode]} Every email has a link to stop or change your alerts.`}</p>
            </div>
          ) : status.phase === "offline" ? (
            <p role="status" className="text-sm text-muted">
              Alerts aren&apos;t switched on yet. Use Save to keep it on your list for now.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <fieldset>
                <legend className="text-sm font-semibold">Email me when</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {PRODUCT_ALERT_MODES.map((k) => {
                    const on = mode === k;
                    return (
                      <label key={k} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${on ? "border-accent bg-accent-soft" : "border-line hover:border-accent/50"}`}>
                        <input type="radio" name={`${id}-mode`} value={k} checked={on} onChange={() => setMode(k)} className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--c-accent))]" />
                        <span className="min-w-0">
                          <span className={`block text-sm font-semibold ${on ? "text-accent" : ""}`}>{PRODUCT_ALERT_MODE[k].label}</span>
                          <span className="block text-xs text-muted">{PRODUCT_ALERT_MODE[k].hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {mode === "under" && (
                <label className="block">
                  <span className="text-sm font-semibold">
                    At or under <span className="font-normal text-subtle">({cur})</span>
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
                    placeholder="1899"
                    className={`${field} mt-1 font-mono`}
                  />
                  <span className="mt-0.5 block text-xs text-subtle">{now !== null ? `Lowest today: ${price(now, cur)}` : "No price here yet."}</span>
                </label>
              )}

              {showCondition && (
                <fieldset>
                  <legend className="text-sm font-semibold">Condition</legend>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {ALERT_CONDITIONS.map((c) => (
                      <label key={c} className={`btn-ghost cursor-pointer text-xs ${condition === c ? "border-accent text-accent" : ""}`}>
                        <input type="radio" name={`${id}-cond`} value={c} checked={condition === c} onChange={() => pick(c)} className="sr-only" />
                        {ALERT_CONDITION_LABEL[c]}
                      </label>
                    ))}
                  </div>
                  {mode === "drop" && now !== null && <span className="mt-1 block text-xs text-subtle">Lowest today: {price(now, cur)}</span>}
                </fieldset>
              )}
              {(mode === "restock" || mode === "preorder") && state && (
                <p className="text-xs text-subtle">
                  Today in {MARKETS[market].name}: {ORDER_STATE_LABEL[state].toLowerCase()} at the stores we check. Stores only, never marketplace resellers.
                </p>
              )}

              <label className="block">
                <span className="text-sm font-semibold">Email</span>
                <input type="email" name="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={EMAIL_MAX} placeholder="you@example.com" className={`${field} mt-1`} />
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
                <span className="text-[11px] text-subtle">No account needed. We check after every price update (about every three hours). See our privacy page.</span>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}
