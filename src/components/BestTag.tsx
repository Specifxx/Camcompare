"use client";
// The small, neutral "Best price" tag on a plain (non-affiliate) cheapest row (owner, 2026-11-18), with an optional "i" hint:
// the title and aria-label carry the text for a pointer and a screen reader, a tap shows it as a muted line on a phone.
import { useState } from "react";
import { BEST_PRICE_TAG } from "@/lib/best-tag";

export function BestTag({ hint, label = BEST_PRICE_TAG }: { hint?: string | null; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex flex-wrap items-center gap-1" data-best-tag>
      <span className="rounded border border-line px-1.5 py-px text-[11px] font-semibold text-muted">{label}</span>
      {hint && (
        <>
          <button
            type="button"
            title={hint}
            aria-label={hint}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-line text-[10px] font-semibold leading-none text-muted hover:border-subtle"
          >
            i
          </button>
          {open && (
            <span role="note" className="basis-full text-xs font-normal text-muted">
              {hint}
            </span>
          )}
        </>
      )}
    </span>
  );
}
