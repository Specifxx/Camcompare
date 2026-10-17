"use client";
// Reveal on scroll. Where the browser has scroll timelines, CSS ties the
// reveal to the scroll position (.cc-sd / .cc-sd-stagger in globals.css), no
// script. Elsewhere an IntersectionObserver adds the hidden state, only to
// blocks still below the fold, so nothing visible ever flashes. Server HTML
// and no-JS visitors see everything; reduced motion gets no motion.
//
// stagger: the direct children cascade in (use it ON the grid: as="ul").
import { createElement, useEffect, useLayoutEffect, useRef } from "react";
import { prefersReducedMotion, supportsScrollTimeline } from "@/lib/motion";

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function Reveal({
  as = "div",
  stagger = false,
  className = "",
  children,
  id,
}: {
  as?: "div" | "section" | "ul" | "ol";
  stagger?: boolean;
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useIso(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || supportsScrollTimeline() || !("IntersectionObserver" in window)) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen: leave it
    const hidden = stagger ? "reveal-stagger" : "reveal-init";
    el.classList.add(hidden);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add("reveal-in");
          io.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px 0px 120px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [stagger]);
  return createElement(as, { ref, id, className: `${stagger ? "cc-sd-stagger" : "cc-sd"} ${className}`.trim() }, children);
}
