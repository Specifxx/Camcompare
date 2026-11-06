"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// The phone dock, ported from the sister sites (DexCompare, WargameCompare, KaeYoung, Compare Empire; owner 2026-11-06: the side rails' ads "on mobile … in
// the best way that doesn't interrupt user experience"): the left rail's eBay tiles in a slim bar along the foot of a screen too
// narrow for the rails. Its rules (DECISIONS.md, 2026-11-06 "Side rails and the phone dock"):
//
//   • Browser only, narrow screens only (below the rails' MIN_WIDTH). Nothing is in the server HTML, and nothing is asked for until
//     the visitor has scrolled a third of a screen (DockGate).
//   • Never on the first screen: it shows only once the visitor has scrolled DOCK_ARM of a screen.
//   • Never beside another unit: hidden while the footer, the rating card, a price table or anything marked [data-dock-yield] is
//     in view or about to be (120 px), never on a product page ([data-no-dock]: its own eBay and store rows are the unit there), never while a dialog,
//     the menu or the keyboard is open.
//   • Fixed, 64 px plus the safe area, sliding on transform only: nothing on the page moves (CLS 0).
//   • eBay only: Amazon's Operating Agreement allows no Amazon link in an overlay, and a bar fixed over the page is one.
//   • ✕ hides it for the rest of the visit (sessionStorage). Labelled "Ad", links rel sponsored under their own subId (cc-<market>-dock-ebay).

export const DOCK_ARM = 0.6;
export const DOCK_H = 64;
const DISMISS_KEY = "ad-dock-off";

export interface DockState {
  narrow: boolean;
  scrolled: number;
  screen: number;
  blockers: number;
  buybar: boolean;
  modal: boolean;
  typing: boolean;
  dismissed: boolean;
}

/** Whether the dock shows. Pure, for the tests. */
export function dockShows(s: DockState): boolean {
  return s.narrow && s.scrolled >= s.screen * DOCK_ARM && s.blockers === 0 && !s.buybar && !s.modal && !s.typing && !s.dismissed;
}

function dismissedThisVisit(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Renders its children only on a screen narrower than `minWidth`, once the visitor has scrolled a third of a screen. */
export function DockGate({ minWidth, children }: { minWidth: number; children: ReactNode }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (dismissedThisVisit()) return;
    const wide = window.matchMedia(`(min-width: ${minWidth}px)`);
    const check = () => {
      if (!wide.matches && window.scrollY >= window.innerHeight * (DOCK_ARM / 2)) {
        setArmed(true);
        window.removeEventListener("scroll", check);
      }
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, [minWidth]);
  return armed ? <>{children}</> : null;
}

export const DOCK_LINK = "flex h-12 min-w-0 items-center gap-2 rounded-lg pr-1 outline-offset-2";

/** One tile: the picture, the brand with its "Ad" pill, one line of title and the price. */
export function DockTile({ img, alt, brand, title, price, cta }: { img: string; alt: string; brand: ReactNode; title: string; price: string; cta: string }) {
  return (
    <>
      <span className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-md bg-white">
        <img src={img} alt={alt} width={44} height={44} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-contain p-0.5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex h-3.5 items-center gap-1 text-[10px] font-semibold leading-none text-muted">
          {brand}
          <span className="rounded bg-raised px-1 py-px text-[9px] uppercase tracking-wide">Ad</span>
        </span>
        <span className="mt-0.5 truncate text-xs font-semibold leading-4 text-fg">{title}</span>
        <span className="truncate text-sm font-bold tabular-nums leading-4 text-accent">{price}</span>
      </span>
      <span className="dock-cta shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-bold text-fg">
        {cta} <span aria-hidden="true">↗</span>
      </span>
    </>
  );
}

export function AdDock({ label, items, placement, minWidth, yieldTo = "[data-ad]", buybar = "[data-no-dock]" }: { label: string; items: ReactNode[]; placement: string; minWidth: number; yieldTo?: string; buybar?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [shown, setShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [turn, setTurn] = useState(0);
  const visible = shown && !dismissed;

  useEffect(() => {
    const dock = ref.current;
    if (!dock || typeof IntersectionObserver === "undefined") return;
    const wide = window.matchMedia(`(min-width: ${minWidth}px)`);
    const blockers = new Set<Element>();
    let typing = false;
    const modal = () =>
      !!document.querySelector("dialog[open], [aria-modal='true']") || document.body.style.overflow === "hidden" || document.documentElement.style.overflow === "hidden";
    const update = () =>
      setShown(
        dockShows({
          narrow: !wide.matches,
          scrolled: window.scrollY,
          screen: window.innerHeight,
          blockers: blockers.size,
          buybar: !!document.querySelector(buybar),
          modal: modal(),
          typing,
          dismissed: false,
        }),
      );
    const watched = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.target.isConnected) blockers.add(e.target);
          else blockers.delete(e.target);
        }
        update();
      },
      { rootMargin: "120px 0px 120px 0px" },
    );
    const scan = () => {
      const now = new Set<Element>([...document.querySelectorAll(`footer, [data-dock-yield], [data-rate-card], ${yieldTo}`)].filter((el) => !dock.contains(el)));
      for (const el of now) if (!watched.has(el)) (watched.add(el), io.observe(el));
      for (const el of [...watched]) {
        if (now.has(el)) continue;
        watched.delete(el);
        io.unobserve(el);
        blockers.delete(el);
      }
      update();
    };
    scan();
    let frame = 0;
    const later = () => {
      if (!frame) frame = requestAnimationFrame(() => ((frame = 0), scan()));
    };
    const mo = new MutationObserver(later);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-ad", "data-dock-yield", "data-no-dock", "open", "aria-modal", "style"] });
    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      typing = !!t?.matches?.("input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select, [contenteditable='true']");
      update();
    };
    const onBlur = () => {
      typing = false;
      update();
    };
    window.addEventListener("scroll", later, { passive: true });
    window.addEventListener("resize", later, { passive: true });
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    wide.addEventListener?.("change", update);
    return () => {
      io.disconnect();
      mo.disconnect();
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", later);
      window.removeEventListener("resize", later);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      wide.removeEventListener?.("change", update);
    };
  }, [minWidth, yieldTo, buybar]);

  // Each time it comes back, the next tile (never animated on its own).
  useEffect(() => {
    if (visible) setTurn((n) => n + 1);
  }, [visible]);
  useEffect(() => {
    const ul = list.current;
    const first = ul?.firstElementChild as HTMLElement | null;
    if (!ul || !first || items.length === 0) return;
    ul.scrollTo({ left: (Math.max(0, turn - 1) % items.length) * (first.offsetWidth + 8), behavior: "instant" as ScrollBehavior });
  }, [turn, items.length]);

  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current as (HTMLDivElement & { inert?: boolean }) | null;
    if (el) el.inert = !visible;
    root.toggleAttribute("data-ad-dock", visible);
    if (!visible || !el) return;
    root.style.scrollPaddingBottom = `${el.offsetHeight}px`;
    return () => {
      root.style.scrollPaddingBottom = "";
      root.removeAttribute("data-ad-dock");
    };
  }, [visible]);

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage blocked: hidden for this page only */
    }
  }

  return (
    <div
      ref={ref}
      role="region"
      aria-label={label}
      aria-hidden={visible ? undefined : true}
      data-ad={visible ? placement : undefined}
      data-dock={visible ? "shown" : "hidden"}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur ${
        visible ? "translate-y-0 transition-transform duration-200 ease-out motion-reduce:transition-none" : "invisible translate-y-full"
      }`}
    >
      <div className="mx-auto flex h-12 max-w-[640px] items-center gap-2">
        <ul ref={list} role="list" className="flex min-w-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item, i) => (
            <li key={i} className="w-[calc(100%-14px)] shrink-0 snap-start sm:w-[calc(50%-8px)]">
              {item}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide these ads for this visit"
          className="-mr-2 inline-flex h-11 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-fg"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
