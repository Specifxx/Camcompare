"use client";
// Share-for-a-deal (owner, 2026-11-18: "share this link and get a free deal … it's all free, but we'll give you something
// else to look at if you share"). Half of browsers (kept in localStorage) see "Share · get a deal"; after a share completes the
// button opens this small card under itself (the visitor's own tap, ✕ to close) pointing to today's deals. Everything on the
// deals page is free for everyone; the other half is the control. Events: share { medium, arm }, share_unlock { medium }.
import { useEffect, useState } from "react";

export type ShareArm = "reward" | "plain";
export const SHARE_ARM_KEY = "share_arm";

export function pickShareArm(saved: string | null | undefined, roll: number): ShareArm {
  if (saved === "reward" || saved === "plain") return saved;
  return roll < 0.5 ? "reward" : "plain";
}

export function useShareArm(): ShareArm {
  const [arm, setArm] = useState<ShareArm>("plain");
  useEffect(() => {
    try {
      const a = pickShareArm(localStorage.getItem(SHARE_ARM_KEY), Math.random());
      localStorage.setItem(SHARE_ARM_KEY, a);
      setArm(a);
    } catch {}
  }, []);
  return arm;
}

export function ShareThanks({ href, line, onClose }: { href: string; line: string; onClose: () => void }) {
  return (
    <span className="absolute left-0 top-full z-20 mt-2 flex w-72 max-w-[85vw] flex-col gap-1.5 rounded-xl border border-fg/15 bg-bg p-3 text-left text-sm text-fg shadow-lg">
      <span className="flex items-start justify-between gap-2">
        <span className="font-semibold">Thanks for sharing. Your deal:</span>
        <button type="button" onClick={onClose} className="opacity-60" aria-label="Close">✕</button>
      </span>
      <span className="opacity-75">{line}</span>
      <a href={href} className="text-xs font-semibold underline">See today’s deals →</a>
    </span>
  );
}
