"use client";
// Fallback for browsers without CSS scroll timelines: writes the hero's scroll
// progress (0..1) to --hero-p, which globals.css reads under
// @supports not (animation-timeline: scroll()). Renders nothing.
import { useEffect } from "react";
import { prefersReducedMotion, supportsScrollTimeline } from "@/lib/motion";

export default function HeroScroll({ target }: { target: string }) {
  useEffect(() => {
    const el = document.getElementById(target);
    if (!el || prefersReducedMotion() || supportsScrollTimeline()) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => el.style.setProperty("--hero-p", String(Math.min(1, window.scrollY / (window.innerHeight * 0.8)))));
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      window.removeEventListener("scroll", on);
      cancelAnimationFrame(raf);
    };
  }, [target]);
  return null;
}
