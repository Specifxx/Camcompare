"use client";
import { track } from "@vercel/analytics";
// The feedback form: in the floating panel (FeedbackWidget, `compact`) and on
// /feedback. What it's about, the message, an optional email for a reply;
// the page and market are added for us and shown to the visitor. Spam guards
// live mostly on the server (lib/feedback.ts): a hidden honeypot field, the
// time since the form opened, length caps and a per-IP rate limit.
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { EMAIL_MAX, FEEDBACK_KINDS, KIND_LABEL, KIND_PROMPT, MESSAGE_MAX, MESSAGE_MIN, PAGE_MAX, rememberedPage, type FeedbackKind } from "@/lib/feedback-kinds";
import { useMarket } from "@/lib/market-client";
import { MARKETS } from "@/lib/markets";

type Status = { phase: "idle" | "sending" | "done" | "offline" } | { phase: "error"; error: string; field?: "message" | "email" };

const field =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-fg placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 sm:text-sm";

export function NotConnected() {
  return (
    <div className="rounded-lg border border-line bg-raised p-4 text-sm">
      <p className="font-semibold">Feedback isn&apos;t connected yet.</p>
      <p className="mt-1 text-muted">We&apos;re still setting this part of the site up. Please check back soon.</p>
    </div>
  );
}

export default function FeedbackForm({ connected, compact = false }: { connected: boolean; compact?: boolean }) {
  const pathname = usePathname() ?? "/";
  const market = useMarket(pathname);
  const id = useId();
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const [page, setPage] = useState(pathname);
  const openedAt = useRef(0);

  useEffect(() => {
    openedAt.current = Date.now();
  }, []);
  // The page this message is about: where the visitor is, or on /feedback
  // itself the page they came from (rememberPage, noted by the floating button).
  useEffect(() => {
    const here = `${window.location.pathname}${window.location.search}`;
    setPage((pathname === "/feedback" ? rememberedPage() ?? here : here).slice(0, PAGE_MAX));
  }, [pathname]);

  if (!connected || status.phase === "offline") return <NotConnected />;

  if (status.phase === "done") {
    return (
      <div role="status" className={`text-center ${compact ? "py-2" : "card p-8"}`}>
        <svg aria-hidden width="40" height="40" viewBox="0 0 24 24" className="mx-auto text-win">
          <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.15" />
          <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="mt-2 font-bold">Thanks, your feedback is in.</p>
        <p className="mt-1 text-sm text-muted">
          We read every message{email.trim() ? `, and we'll write to ${email.trim()} if we need to know more` : ""}.
        </p>
        <button
          type="button"
          className="btn-ghost mt-4"
          onClick={() => {
            setKind(null);
            setMessage("");
            setEmail("");
            setStatus({ phase: "idle" });
            openedAt.current = Date.now();
          }}
        >
          Send another
        </button>
      </div>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.phase === "sending") return;
    if (message.trim().length < MESSAGE_MIN) return setStatus({ phase: "error", error: `Write a little more (at least ${MESSAGE_MIN} characters).`, field: "message" });
    const emailInput = e.currentTarget.elements.namedItem("email") as HTMLInputElement | null;
    if (email.trim() && emailInput && !emailInput.validity.valid)
      return setStatus({ phase: "error", error: "That email doesn't look right. Leave it empty if you don't need a reply.", field: "email" });
    setStatus({ phase: "sending" });
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: kind ?? "other", message, email: email.trim(), page, market, elapsedMs: Date.now() - openedAt.current, website }),
      });
      if (res.status === 503) return setStatus({ phase: "offline" });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !d.ok) return setStatus({ phase: "error", error: d.error ?? "Something went wrong. Please try again." });
      try {
        track("feedback_sent", { kind: kind ?? "other" });
      } catch {
        /* analytics never blocks */
      }
      setStatus({ phase: "done" });
    } catch {
      setStatus({ phase: "error", error: "We couldn't reach the server. Check your connection and try again." });
    }
  }

  const err = status.phase === "error" ? status : null;
  const left = MESSAGE_MAX - message.length;
  return (
    <form onSubmit={submit} noValidate className={compact ? "space-y-3" : "card space-y-4 p-5 sm:p-6"}>
      <fieldset>
        <legend className="text-sm font-semibold">What&apos;s it about?</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {FEEDBACK_KINDS.map((k) => (
            <label
              key={k}
              className={`cursor-pointer select-none rounded-full border px-3 py-1.5 text-xs font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/50 ${
                kind === k ? "border-accent bg-accent text-accent-fg" : "border-line bg-raised text-muted hover:text-fg"
              }`}
            >
              <input type="radio" name={`${id}-kind`} value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {KIND_LABEL[k]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-semibold">Your message</span>
        <textarea
          name="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={compact ? 4 : 6}
          maxLength={MESSAGE_MAX}
          required
          placeholder={KIND_PROMPT[kind ?? "other"]}
          aria-invalid={err?.field === "message" || undefined}
          aria-describedby={err ? `${id}-error` : undefined}
          className={`${field} mt-1 resize-y`}
        />
        {left < 500 && <span className="mt-0.5 block text-right text-xs text-subtle">{left} characters left</span>}
      </label>

      <label className="block">
        <span className="text-sm font-semibold">
          Email <span className="font-normal text-subtle">(optional, only if you&apos;d like a reply)</span>
        </span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={EMAIL_MAX}
          placeholder="you@example.com"
          aria-invalid={err?.field === "email" || undefined}
          aria-describedby={err ? `${id}-error` : undefined}
          className={`${field} mt-1`}
        />
      </label>

      {/* Honeypot: never shown, never tabbed to. People leave it empty; bots fill it. */}
      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      <p className="text-xs text-subtle">
        We&apos;ll include the page you&apos;re on (<span className="break-all font-mono">{page}</span>) and your market ({MARKETS[market].short}) so we can find what you mean.
      </p>

      {err && (
        <p id={`${id}-error`} role="alert" className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-fg">
          {err.error}
        </p>
      )}

      <button type="submit" disabled={status.phase === "sending"} className="btn-primary w-full disabled:opacity-60">
        {status.phase === "sending" ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
