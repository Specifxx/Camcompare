"use client";
// Page sections fade up as they scroll into view (globals.css, "Motion").
// Only sections below the fold on arrival are hidden, and only once this has
// run, so the server HTML, crawlers, no-JS visitors and reduced-motion users
// see everything at once. Re-arms on each client navigation.
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function Reveal() {
  const pathname = usePathname();
  useEffect(() => {
    if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const fold = window.innerHeight;
    const els = [...document.querySelectorAll<HTMLElement>("main section")].filter((el) => el.getBoundingClientRect().top > fold && !el.closest("section section"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("rv-in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    for (const el of els) {
      el.classList.add("rv");
      io.observe(el);
    }
    return () => {
      io.disconnect();
      for (const el of els) el.classList.remove("rv", "rv-in");
    };
  }, [pathname]);
  return null;
}
