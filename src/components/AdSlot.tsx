"use client";
// Display ads, off until the owner turns them on (NEXT_PUBLIC_ADSENSE_CLIENT
// and a slot id). Until then this renders nothing at all — no empty boxes.
// Rules carried from RiftCompare's AdSense work: never next to a buy button,
// never above the price on a product page, no interstitials, and the slot
// reserves its height so the page doesn't jump (CLS).
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "";

export default function AdSlot({ slot, className = "" }: { slot: string | undefined; className?: string }) {
  const ref = useRef<HTMLModElement>(null);
  useEffect(() => {
    if (!CLIENT || !slot || !ref.current || ref.current.dataset.loaded) return;
    ref.current.dataset.loaded = "1";
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* blocked by an extension: fine */
    }
  }, [slot]);
  if (!CLIENT || !slot) return null;
  return (
    <aside aria-label="Advertisement" className={`my-8 min-h-[280px] ${className}`}>
      <p className="mb-1 text-[10px] uppercase tracking-wide text-subtle">Advertisement</p>
      <ins ref={ref} className="adsbygoogle block" style={{ display: "block" }} data-ad-client={CLIENT} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  );
}
