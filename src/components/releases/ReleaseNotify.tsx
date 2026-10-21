"use client";
// The two alert forms on /releases (POST /api/alerts, lib/alerts.ts):
//  - <OrderNotify>: "Notify me when it can be ordered" on a card: a preorder
//    alert for the product it names, or for the release itself when it names
//    none of ours yet (it fires once a store lists a product it names).
//  - <BrandFollow>: "Email me when <maker> announces something".
// No account: a confirm email first, a stop link in every email.
import { useId, useRef, useState } from "react";
import type { MarketCode } from "@/lib/markets";
import { BRAND_GROUPS, RELEASE_BRANDS } from "@/lib/releases/brands";
import { alertField, postAlert, type AlertStatus } from "../alert-post";

function Done({ status, what }: { status: AlertStatus; what: string }) {
  if (status.phase === "offline") return <p role="status" className="text-sm text-muted">Alerts aren&apos;t switched on yet. Please check back soon.</p>;
  if (status.phase !== "done") return null;
  return (
    <p role="status" className="text-sm">
      <span className="font-semibold">{status.confirm ? "Check your inbox. " : "Done. "}</span>
      <span className="text-muted">{status.confirm ? "Click the link we sent and alerts start." : `We'll email you ${what}.`}</span>
    </p>
  );
}

function Trap({ value, set }: { value: string; set: (v: string) => void }) {
  return (
    <div className="hidden" aria-hidden="true">
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => set(e.target.value)} />
      </label>
    </div>
  );
}

const Bell = () => (
  <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

export function OrderNotify({ kind, slug, market, label = "Notify me when it can be ordered" }: { kind: "release" | "camera" | "lens"; slug: string; market: MarketCode; label?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<AlertStatus>({ phase: "idle" });
  const openedAt = useRef(0);

  if (status.phase === "done" || status.phase === "offline") return <Done status={status} what="the moment a store takes orders" />;
  return (
    <div className={open ? "w-full" : ""}>
      {!open ? (
        <button
          type="button"
          className="btn-primary text-sm"
          aria-expanded={false}
          aria-controls={`${id}-f`}
          onClick={() => {
            openedAt.current = Date.now();
            setOpen(true);
          }}
        >
          <Bell /> {label}
        </button>
      ) : (
        <form
          id={`${id}-f`}
          noValidate
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setStatus({ phase: "sending" });
            setStatus(await postAlert({ email, slug, kind, market, type: "preorder", elapsedMs: Date.now() - openedAt.current, website }));
          }}
        >
          <label className="min-w-0 flex-1 basis-56">
            <span className="text-xs font-semibold">Email me when a store takes preorders or has it in stock</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={`${alertField} mt-1`} />
          </label>
          <Trap value={website} set={setWebsite} />
          <button type="submit" disabled={status.phase === "sending" || !email.trim()} className="btn-primary disabled:opacity-60">
            {status.phase === "sending" ? "Saving…" : "Notify me"}
          </button>
          {status.phase === "error" && (
            <p role="alert" className="w-full rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm">
              {status.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

/** `collapsible`: below lg, a one-line button that opens the form (the page's feed comes first on a phone). */
export function BrandFollow({ market, initial = "", collapsible = false }: { market: MarketCode; initial?: string; collapsible?: boolean }) {
  const [shown, setShown] = useState(!collapsible);
  const [brand, setBrand] = useState(initial);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<AlertStatus>({ phase: "idle" });
  const openedAt = useRef(0);
  const name = RELEASE_BRANDS.find((b) => b.key === brand)?.name;

  return (
    <div className="card p-4">
      {collapsible && (
        <button type="button" onClick={() => setShown(!shown)} aria-expanded={shown} className="flex w-full items-center justify-between gap-2 text-left lg:hidden">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Bell /> Email me when a maker announces something
          </span>
          <span aria-hidden className={`text-subtle transition-transform ${shown ? "rotate-180" : ""}`}>
            ▾
          </span>
        </button>
      )}
      <div className={collapsible ? `${shown ? "mt-3" : "hidden"} lg:mt-0 lg:block` : ""}>
      <h2 className={`text-base font-semibold ${collapsible ? "hidden lg:block" : ""}`}>Hear about the next drop first</h2>
      <p className="mt-0.5 text-sm text-muted">Pick a maker. We email you when it announces something, with the video and any store taking orders.</p>
      {status.phase === "done" || status.phase === "offline" ? (
        <div className="mt-3">
          <Done status={status} what={`when ${name ?? "they"} announce something`} />
        </div>
      ) : (
        <form
          noValidate
          className="mt-3 grid gap-2"
          onFocus={() => {
            if (!openedAt.current) openedAt.current = Date.now();
          }}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!brand) return setStatus({ phase: "error", error: "Pick a maker first." });
            setStatus({ phase: "sending" });
            setStatus(await postAlert({ email, slug: brand, kind: "brand", market, type: "brand", elapsedMs: Date.now() - openedAt.current, website }));
          }}
        >
          <label className="block">
            <span className="text-xs font-semibold">Maker</span>
            <select value={brand} onChange={(e) => setBrand(e.target.value)} className={`${alertField} mt-1`}>
              <option value="">Choose…</option>
              {BRAND_GROUPS.map((g) => (
                <optgroup key={g} label={g}>
                  {RELEASE_BRANDS.filter((b) => b.group === g).map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold">Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={`${alertField} mt-1`} />
          </label>
          <Trap value={website} set={setWebsite} />
          <button type="submit" disabled={status.phase === "sending" || !email.trim()} className="btn-primary disabled:opacity-60">
            <Bell /> {status.phase === "sending" ? "Saving…" : "Email me"}
          </button>
          {status.phase === "error" && (
            <p role="alert" className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm">
              {status.error}
            </p>
          )}
        </form>
      )}
      <p className="mt-2 text-[11px] text-subtle">Free. We check after every price update, about every three hours. Every email has a one-click stop link.</p>
      </div>
    </div>
  );
}
