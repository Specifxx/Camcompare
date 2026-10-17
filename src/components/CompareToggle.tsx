"use client";
import { useState } from "react";

/** Wraps the compare table; "differences only" hides rows whose cells all match (globals.css). */
export default function CompareToggle({ children }: { children: React.ReactNode }) {
  const [diff, setDiff] = useState(false);
  return (
    <div data-diff-only={diff}>
      <label className="mb-3 inline-flex cursor-pointer items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={diff} onChange={(e) => setDiff(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--c-accent))]" />
        Show differences only
      </label>
      {children}
    </div>
  );
}
