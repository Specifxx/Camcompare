"use client";
// Small pieces every community view shares: plain text with links, the author
// line, vote arrows, the report link and the sign-in box. Plain on purpose
// (owner, 2026-10-17: "UI needs to be cleaner"): text, thin rules, small
// arrows and a text badge, like old Reddit or Hacker News.
import { useState } from "react";
import { ago, applyVote, CAMEXPERT_KARMA, CAMEXPERT_MIN_ACCOUNT_DAYS, checkUsername, linkSegments, nextVote, REPORT_REASON_LABEL, REPORT_REASONS, userPath, type Author, type ReportReason, type VoteKind, type VoteValue } from "@/lib/community/rules";
import { api, inputClass, linkButton, refreshMe, useMe } from "./client";

/** Text as typed: line breaks kept, http(s) links clickable with rel="nofollow ugc noopener". Never HTML. */
export function PlainText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${className}`}>
      {linkSegments(text).map((s, i) =>
        s.type === "link" ? (
          <a key={i} href={s.href} rel="nofollow ugc noopener noreferrer" target="_blank">
            {s.text}
          </a>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </div>
  );
}

export function ExpertBadge() {
  return (
    <span title={`CamExpert: ${CAMEXPERT_KARMA}+ CamKarma and a member for ${CAMEXPERT_MIN_ACCOUNT_DAYS}+ days`} className="ml-1 text-[11px] font-semibold text-accent">
      [CamExpert]
    </span>
  );
}

export function AuthorLine({ author, createdAt, editedAt, extra }: { author: Author | null; createdAt: string; editedAt?: string | null; extra?: React.ReactNode }) {
  return (
    <p className="text-xs text-muted">
      {author ? (
        <>
          <a href={userPath(author.username)} className="font-semibold text-fg">
            {author.username}
          </a>
          {author.expert && <ExpertBadge />}
          <span className="text-subtle"> · {author.karma} karma</span>
        </>
      ) : (
        <span className="text-subtle">[deleted]</span>
      )}
      <span className="text-subtle">
        {" "}
        · <time dateTime={createdAt}>{ago(createdAt)}</time>
        {editedAt ? " (edited)" : ""}
      </span>
      {extra}
    </p>
  );
}

/**
 * ▲ score ▼, stacked (or in a row with `inline`). Clicking your arrow again
 * removes your vote. Signed out, a click calls `onNeedSignIn`.
 */
export function VoteArrows({
  kind,
  target,
  score,
  mine,
  inline = false,
  disabled = false,
  onNeedSignIn,
  onVoted,
}: {
  kind: VoteKind;
  target: string;
  score: number;
  mine: VoteValue;
  inline?: boolean;
  /** Your own post: arrows shown but inactive. */
  disabled?: boolean;
  onNeedSignIn?: () => void;
  onVoted?: (value: VoteValue, score: number) => void;
}) {
  const { user } = useMe();
  const [s, setS] = useState({ score, mine });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // A new score from the parent (a reload) wins over local state.
  const [seen, setSeen] = useState({ score, mine });
  if (seen.score !== score || seen.mine !== mine) {
    setSeen({ score, mine });
    setS({ score, mine });
  }

  const click = async (dir: 1 | -1) => {
    if (disabled || busy) return;
    if (!user?.username) return onNeedSignIn?.();
    const prev = s;
    const value = nextVote(s.mine, dir);
    setS({ mine: value, score: applyVote(s.score, s.mine, value) });
    setBusy(true);
    const r = await api<{ score: number; value: VoteValue }>("/api/community/votes", { method: "POST", body: { kind, target, value } });
    setBusy(false);
    if (!r.ok) {
      setS(prev);
      setErr(r.error);
      return;
    }
    setErr("");
    setS({ mine: r.value, score: r.score });
    onVoted?.(r.value, r.score);
  };

  const arrow = (dir: 1 | -1) => (
    <button
      type="button"
      onClick={() => click(dir)}
      disabled={disabled}
      aria-pressed={s.mine === dir}
      aria-label={dir === 1 ? "Upvote" : "Downvote"}
      className={`cc-vote px-1 text-[11px] leading-none ${s.mine === dir ? "text-accent" : "text-subtle hover:text-fg"} disabled:opacity-40`}
    >
      {dir === 1 ? "▲" : "▼"}
    </button>
  );
  return (
    <div className={`flex ${inline ? "flex-row items-center gap-0.5" : "w-8 shrink-0 flex-col items-center"}`} title={err || undefined}>
      {arrow(1)}
      <span className={`price text-xs ${s.mine ? "text-accent" : "text-muted"}`} aria-label={`Score ${s.score}`}>
        {s.score}
      </span>
      {arrow(-1)}
    </div>
  );
}

export function ReportLink({ kind, id, onNeedSignIn }: { kind: "comment" | "review" | "thread" | "post" | "request"; id: string; onNeedSignIn?: () => void }) {
  const { user } = useMe();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  if (msg) return <span className="text-xs text-subtle">{msg}</span>;
  if (!open)
    return (
      <button type="button" className={linkButton} onClick={() => (user ? setOpen(true) : onNeedSignIn?.())}>
        report
      </button>
    );
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs">
      <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)} className="rounded border border-line bg-surface px-1 py-0.5 text-xs">
        {REPORT_REASONS.map((r) => (
          <option key={r} value={r}>
            {REPORT_REASON_LABEL[r]}
          </option>
        ))}
      </select>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note (optional)" className="rounded border border-line bg-surface px-1 py-0.5 text-xs" />
      <button
        type="button"
        className="text-xs font-semibold text-accent"
        onClick={async () => {
          const r = await api("/api/community/report", { method: "POST", body: { kind, id, reason, note } });
          setMsg(r.ok ? "Reported. Thanks: the owner will look." : r.error);
        }}
      >
        send
      </button>
      <button type="button" className={linkButton} onClick={() => setOpen(false)}>
        cancel
      </button>
    </span>
  );
}

/** Pick a public username (once, at first sign-in). */
export function UsernamePicker({ onDone }: { onDone?: () => void }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const c = checkUsername(name);
        if (!c.ok) return setErr(c.error);
        setBusy(true);
        const r = await api("/api/community/auth/username", { method: "POST", body: { username: c.username } });
        setBusy(false);
        if (!r.ok) return setErr(r.error);
        await refreshMe();
        onDone?.();
      }}
    >
      <label className="block text-sm">
        <span className="font-semibold">Pick a username</span>
        <span className="block text-xs text-muted">Shown on everything you post. Your email is never shown. You can&apos;t change it later.</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoComplete="username" className={`${inputClass} mt-1 max-w-xs`} placeholder="e.g. street_shooter" />
      </label>
      {err && <p role="alert" className="text-xs text-warn">{err}</p>}
      <button type="submit" disabled={busy} className="btn-primary px-3 py-1 text-xs disabled:opacity-60">
        {busy ? "Saving…" : "Save username"}
      </button>
    </form>
  );
}

/** The email box: sends a sign-in link. With a member but no username, the username picker instead. */
export function SignInBox({ prompt = "Sign in to post, vote and report.", next }: { prompt?: string; /** Where the emailed link lands after sign-in (default: this page). */ next?: string }) {
  const { user, loaded } = useMe();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<{ phase: "idle" | "sending" | "sent" } | { phase: "error"; error: string }>({ phase: "idle" });
  if (!loaded) return null;
  if (user && !user.username) return <UsernamePicker />;
  if (user) return null;
  if (status.phase === "sent") return <p className="text-sm text-muted">Check your inbox: we&apos;ve sent a sign-in link. It works once, for 15 minutes.</p>;
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setStatus({ phase: "sending" });
        const r = await api("/api/community/auth/request", { method: "POST", body: { email: email.trim(), next: next ?? location.pathname + location.hash, website } });
        setStatus(r.ok ? { phase: "sent" } : { phase: "error", error: r.error });
      }}
    >
      <label className="block min-w-[14rem] flex-1 text-sm">
        <span className="text-muted">{prompt} No password: we email you a link.</span>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" placeholder="you@example.com" className={`${inputClass} mt-1`} />
      </label>
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={website} onChange={(e) => setWebsite(e.target.value)} />
      <button type="submit" disabled={status.phase === "sending" || !email.trim()} className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-60">
        {status.phase === "sending" ? "Sending…" : "Email me a link"}
      </button>
      {status.phase === "error" && (
        <p role="alert" className="w-full text-xs text-warn">
          {status.error}
        </p>
      )}
    </form>
  );
}

export function SortTabs<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <span className="text-xs text-muted">
      sort by:{" "}
      {options.map((o, i) => (
        <span key={o}>
          {i > 0 && " · "}
          <button type="button" onClick={() => onChange(o)} className={value === o ? "font-semibold text-fg" : "hover:underline"} aria-pressed={value === o}>
            {o}
          </button>
        </span>
      ))}
    </span>
  );
}
