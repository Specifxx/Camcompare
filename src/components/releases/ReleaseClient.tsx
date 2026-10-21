"use client";
// The small interactive bits of a release card and the feed around it.
//  - <ReleaseComments>: a "Comments" button that mounts the community
//    Discussion (target "release:<id>") only when opened, so a page of forty
//    cards makes no comment requests until someone asks for one.
//  - <BrandFilter>: chips that hide the cards of other makers (data-brand).
//  - <Ago>: "5 hours ago" against the visitor's clock (the page is static).
import { useEffect, useState } from "react";
import Discussion from "../community/Discussion";
import { shortAgo } from "../home/checked-ago";

export function ReleaseComments({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="btn-ghost text-sm" onClick={() => setOpen(true)} aria-expanded={false}>
        <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Comments
      </button>
    );
  return (
    <div className="w-full basis-full border-t border-line pt-3">
      <Discussion target={`release:${id}`} name={name} />
    </div>
  );
}

export function Ago({ at }: { at: string }) {
  const [ago, setAgo] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setAgo(shortAgo(at, Date.now()));
    tick();
    const t = window.setInterval(tick, 60_000);
    return () => window.clearInterval(t);
  }, [at]);
  const d = new Date(at);
  return (
    <time dateTime={at} title={d.toUTCString()}>
      {ago ?? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
    </time>
  );
}

export function BrandFilter({ brands, target }: { brands: { key: string; name: string; n: number }[]; target: string }) {
  const [pick, setPick] = useState<string | null>(null);
  useEffect(() => {
    const root = document.getElementById(target);
    if (!root) return;
    let shown = 0;
    root.querySelectorAll<HTMLElement>("[data-brand]").forEach((el) => {
      const on = !pick || el.dataset.brand === pick;
      el.hidden = !on;
      if (on) shown++;
    });
    root.dataset.shown = String(shown);
  }, [pick, target]);
  const chip = (key: string | null, label: string, n?: number) => (
    <button key={key ?? "all"} type="button" aria-pressed={pick === key} onClick={() => setPick(key)} className={`chip-link shrink-0 whitespace-nowrap px-3 py-1 text-sm ${pick === key ? "border-accent bg-accent-soft text-accent" : ""}`}>
      {label}
      {n !== undefined && <span className="ml-1 font-mono text-[10px] text-subtle">{n}</span>}
    </button>
  );
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="group" aria-label="Filter by maker">
      {chip(null, "All makers")}
      {brands.map((b) => chip(b.key, b.name, b.n))}
    </div>
  );
}
