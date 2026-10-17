"use client";
// The floating "Feedback" button on every page, and the small form panel it
// opens. Never opens by itself.
//
// Placement: bottom LEFT, because buy buttons sit at the right end of every
// offer row. It lifts itself above any fixed bar along the bottom edge (the
// compare tray on /cameras and /lenses, a consent banner, an anchor ad), and
// steps aside while an ad slot passes under it: AdSense doesn't allow ads
// covered by floating elements. The panel keeps its draft when closed.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isFeedbackHiddenPath, rememberPage } from "@/lib/feedback-kinds";
import FeedbackForm from "./FeedbackForm";

export default function FeedbackWidget({ connected }: { connected: boolean }) {
  const pathname = usePathname() ?? "/";
  const hiddenHere = isFeedbackHiddenPath(pathname);
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false); // mount the form on first open, then keep it
  const [lift, setLift] = useState(0);
  const [overAd, setOverAd] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // The last real page, for the /feedback form (see rememberPage).
  useEffect(() => {
    if (!hiddenHere) rememberPage(`${window.location.pathname}${window.location.search}`);
  }, [pathname, hiddenHere]);

  // A new page closes the panel (the draft stays).
  useEffect(() => setOpen(false), [pathname]);

  // Stay clear of fixed bottom bars and ad slots. Bars come and go with the
  // DOM (a tray appears when a product is picked), so the check re-runs on
  // DOM changes, debounced; ads move with the page, so that check runs on scroll.
  useEffect(() => {
    if (hiddenHere) return;
    let timer = 0;
    let frame = 0;
    let ads: Element[] = [];
    const probeX = () => {
      const r = button.current?.getBoundingClientRect();
      return r && r.width ? [r.left + 6, r.right - 6] : [22, 110];
    };
    const measure = () => {
      const h = window.innerHeight;
      let top = h;
      for (const x of probeX()) {
        for (const el of document.elementsFromPoint(x, h - 2)) {
          if (root.current?.contains(el) || getComputedStyle(el).position !== "fixed") continue;
          const b = el.getBoundingClientRect();
          if (b.height < h / 2) top = Math.min(top, b.top); // a bar, not a full-screen overlay
        }
      }
      setLift(Math.max(0, Math.round(h - top)));
      ads = Array.from(document.querySelectorAll("ins.adsbygoogle, [aria-label='Advertisement']"));
      checkAds();
    };
    const checkAds = () => {
      frame = 0;
      const r = button.current?.getBoundingClientRect();
      if (!r || !r.width) return setOverAd(false);
      setOverAd(ads.some((a) => {
        const b = a.getBoundingClientRect();
        return b.width > 0 && b.top < r.bottom + 8 && b.bottom > r.top - 8 && b.left < r.right && b.right > r.left;
      }));
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, 150);
    };
    const onScroll = () => {
      if (ads.length && !frame) frame = window.requestAnimationFrame(checkAds);
    };
    measure();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      if (frame) window.cancelAnimationFrame(frame);
      mo.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", onScroll);
    };
  }, [hiddenHere]);

  // Escape closes; focus goes back to the button.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      window.requestAnimationFrame(() => button.current?.focus());
    };
    window.addEventListener("keydown", onKey);
    // With a mouse, straight into the message; on touch, don't pop the keyboard over the panel.
    const fine = window.matchMedia?.("(pointer: fine)").matches;
    const target = fine ? panel.current?.querySelector<HTMLElement>("textarea") : null;
    (target ?? panel.current)?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    window.requestAnimationFrame(() => button.current?.focus());
  };

  if (hiddenHere) return null;
  return (
    <div ref={root} className="print:hidden">
      <button
        ref={button}
        type="button"
        onClick={() => {
          setOpened(true);
          setOpen(true);
        }}
        aria-haspopup="dialog"
        style={{ bottom: `calc(${lift}px + max(1rem, env(safe-area-inset-bottom)))` }}
        className={`fixed left-4 z-30 h-10 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-accent-fg shadow-lg ring-1 ring-black/5 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 sm:h-11 sm:px-4 sm:text-sm ${open ? "hidden" : "inline-flex"} ${
          overAd ? "invisible" : ""
        }`}
      >
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z" />
        </svg>
        Feedback
      </button>

      {opened && (
        <div
          ref={panel}
          role="dialog"
          aria-labelledby="cc-feedback-title"
          tabIndex={-1}
          hidden={!open}
          className="fixed inset-x-3 bottom-3 z-50 max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-xl border border-line bg-surface p-4 shadow-2xl focus:outline-none sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-[23rem] sm:max-h-[calc(100vh-6rem)]"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id="cc-feedback-title" className="text-base font-bold">Send us feedback</h2>
              <p className="text-xs text-muted">A wrong price, a bug, a camera we&apos;re missing: we read every message.</p>
            </div>
            <button type="button" onClick={close} aria-label="Close feedback" className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-raised hover:text-fg">
              <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <FeedbackForm connected={connected} compact />
          <p className="mt-3 text-center text-xs">
            <Link href="/feedback" prefetch={false} className="text-muted">
              Open the full feedback page
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
