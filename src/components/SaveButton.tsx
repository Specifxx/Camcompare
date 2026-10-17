"use client";
import { useEffect, useState } from "react";
import type { MarketCode } from "@/lib/markets";
import { readSaved, writeSaved } from "@/lib/saved";

export default function SaveButton({ slug, kind, market, seen }: { slug: string; kind: "camera" | "lens"; market: MarketCode; seen: number | null }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const sync = () => setSaved(readSaved().some((s) => s.slug === slug));
    sync();
    window.addEventListener("cc-saved", sync);
    return () => window.removeEventListener("cc-saved", sync);
  }, [slug]);
  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => {
        const list = readSaved().filter((s) => s.slug !== slug);
        writeSaved(saved ? list : [{ slug, kind: kind === "camera" ? "c" : "l", market, at: new Date().toISOString(), seen }, ...list]);
      }}
      className="btn-ghost"
    >
      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M6 3h12v18l-6-4-6 4z" />
      </svg>
      {saved ? "Saved" : "Save"}
    </button>
  );
}
