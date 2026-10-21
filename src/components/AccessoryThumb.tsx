"use client";
// An accessory listing's photo: the store's own image, hotlinked small from
// its CDN (DECISIONS.md 2026-10-22, "Accessory photos"), or a neutral icon for
// its section when there is none or it fails to load. Fixed square size, so
// rows never shift as images arrive.
import { useState } from "react";

const PATHS: Record<string, string> = {
  // a cage: frame with handle
  rigs: "M5 8h14v10H5zM8 8V5h8v3M9 12h6",
  // a battery
  power: "M4 8h14v8H4zM18 11h2v2h-2M9 10l-1.5 2.5H11L9.5 15",
  // a tripod
  "flash-support": "M12 4v5M9 9h6l-3 4zM12 13l-5 7M12 13l5 7M12 13v7",
  // a light: bulb and rays
  light: "M12 7a4 4 0 0 1 2.5 7.1V16h-5v-1.9A4 4 0 0 1 12 7zM10 19h4M12 2v2M4.9 4.9l1.4 1.4M19.1 4.9l-1.4 1.4",
  // wireless waves
  video: "M12 18h.01M8.5 14.5a5 5 0 0 1 7 0M5.5 11.5a9 9 0 0 1 13 0",
  // a memory card
  media: "M7 3h7l4 4v14H7zM10 3v3M12.5 3v3",
  // record dot in a frame
  recording: "M4 6h16v12H4zM12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5",
  // a microphone
  audio: "M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4",
  // a box
  other: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8",
};

export function CategoryIcon({ group, className = "" }: { group: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d={PATHS[group] ?? PATHS.other} />
    </svg>
  );
}

export default function AccessoryThumb({ src, alt, group, store, size = 56 }: { src: string | null; alt: string; group: string; store: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const box = "flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-white";
  if (!src || failed)
    return (
      <span className={`${box} text-subtle`} style={{ width: size, height: size }} aria-hidden>
        <CategoryIcon group={group} className="h-1/2 w-1/2" />
      </span>
    );
  return (
    <span className={box} style={{ width: size, height: size }} title={`Image: ${store}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- hotlinked from the store's CDN on purpose, never through Vercel's optimiser */}
      <img src={src} alt={alt} width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-contain" onError={() => setFailed(true)} />
    </span>
  );
}
