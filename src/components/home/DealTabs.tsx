"use client";
// The home deals board's tabs (HomeView). Every list is in the server HTML
// (lib/deals-home.ts homeDealViews); this only flips two data attributes on
// the wrapper and globals.css ("home deals") hides the rows that are not in
// the chosen view. Without JS the default view shows.
import { useState } from "react";

type Mode = "used" | "new";
type Kind = "all" | "camera" | "lens";

export default function DealTabs({ counts, defaultMode, children }: { counts: Record<Mode, Record<Kind, number>>; defaultMode: Mode; children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [kind, setKind] = useState<Kind>("all");
  const modes: [Mode, string][] = [
    ["used", "Used vs RRP"],
    ["new", "New vs RRP"],
  ];
  const kinds: [Kind, string][] = [
    ["all", "Everything"],
    ["camera", "Cameras"],
    ["lens", "Lenses"],
  ];
  const pick = (m: Mode) => {
    setMode(m);
    if (!counts[m][kind]) setKind("all");
  };
  return (
    <div className="hd-board" data-mode={mode} data-kind={kind}>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div role="group" aria-label="Compare against RRP" className="hd-seg">
          {modes.filter(([m]) => counts[m].all > 0).map(([m, label]) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => pick(m)} className="hd-seg-btn">
              {label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
          {kinds.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={kind === k} disabled={!counts[mode][k]} onClick={() => setKind(k)} className="hd-pill">
              {label}
              <span className="ml-1 font-mono text-[10px] opacity-70">{counts[mode][k]}</span>
            </button>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
