"use client";
// The header's "More" menu: the sections that don't fit the main nav at
// phone width (curated pages, member stories, My gear, requests). Market
// pages follow the page's market; the global ones don't need to.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { marketPath, type MarketCode } from "@/lib/markets";

export const MORE = [
  { path: "/viral-cameras", label: "Viral cameras", market: true },
  { path: "/digicams", label: "Digicams", market: true },
  { path: "/stories", label: "Member stories", market: false },
  { path: "/collection", label: "My gear", market: false },
  { path: "/community", label: "Community", market: false },
  { path: "/requests", label: "Requests", market: false },
] as const;

/**
 * `icon`: a compact "⋯" button for the phone header's top row (the section
 * row below it is full at 390px); otherwise a "More" text link for the
 * desktop nav.
 */
export default function MoreMenu({ market, pathname, className = "", icon = false }: { market: MarketCode; pathname: string; className?: string; icon?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const links = MORE.map((x) => ({ ...x, href: x.market ? marketPath(market, x.path) : x.path }));
  const active = links.some((l) => pathname === l.href || pathname.startsWith(`${l.href}/`));
  return (
    <div ref={ref} className={`relative ${className}`}>
      {icon ? (
        <button type="button" aria-expanded={open} aria-haspopup="true" aria-label="More sections" onClick={() => setOpen(!open)} className={`flex h-9 w-8 items-center justify-center rounded-md border border-line ${active || open ? "text-fg" : "text-muted"}`}>
          <svg aria-hidden width="16" height="16" viewBox="0 0 16 16">
            <circle cx="3" cy="8" r="1.5" fill="currentColor" />
            <circle cx="8" cy="8" r="1.5" fill="currentColor" />
            <circle cx="13" cy="8" r="1.5" fill="currentColor" />
          </svg>
        </button>
      ) : (
        <button type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)} className={`cc-nav-link inline-flex items-center gap-0.5 ${active || open ? "text-fg" : "text-muted hover:text-fg"}`}>
          More
          <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className={`transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {open && (
        <ul className="absolute right-0 top-full z-40 mt-2 w-48 rounded-md border border-line bg-surface py-1 text-sm shadow-lift">
          {links.map((l) => {
            const on = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <li key={l.path}>
                <Link href={l.href} prefetch={false} aria-current={on ? "page" : undefined} className={`block px-3 py-1.5 no-underline hover:bg-raised hover:no-underline ${on ? "font-semibold text-fg" : "text-muted hover:text-fg"}`}>
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
