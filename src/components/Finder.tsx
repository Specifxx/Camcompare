"use client";
import { useState } from "react";
import type { MarketCode } from "@/lib/markets";
import { recommend, SIZES, USES, type Size, type Use } from "@/lib/finder";
import { priceOf, type CameraSummary } from "@/lib/summary-types";
import ProductCard from "./ProductCard";

export default function Finder({ cameras, market }: { cameras: CameraSummary[]; market: MarketCode }) {
  const [use, setUse] = useState<Use | null>(null);
  const [size, setSize] = useState<Size>("any");
  const [budget, setBudget] = useState<number | null>(null);
  const cur = cameras[0]?.currency ?? "USD";
  const sym = { USD: "$", GBP: "£", EUR: "€", AUD: "A$", SGD: "S$" }[cur];
  const results = use ? recommend(cameras, use, size, budget, priceOf).slice(0, 12) : [];
  return (
    <div className="flex flex-col gap-8">
      <fieldset>
        <legend className="mb-2 font-bold">1. What will you shoot most?</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(USES) as Use[]).map((k) => (
            <button key={k} type="button" aria-pressed={use === k} onClick={() => setUse(k)} className={`card p-3 text-left ${use === k ? "border-accent ring-2 ring-accent/30" : ""}`}>
              <span className="block font-semibold">{USES[k].label}</span>
              <span className="text-xs text-muted">{USES[k].blurb}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-6 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-2 font-bold">2. How big can it be?</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SIZES) as Size[]).map((k) => (
              <button key={k} type="button" aria-pressed={size === k} onClick={() => setSize(k)} className={size === k ? "btn-primary" : "btn-ghost"}>
                {SIZES[k].label}
              </button>
            ))}
          </div>
        </fieldset>
        <label>
          <span className="mb-2 block font-bold">3. Budget for the camera</span>
          <select value={budget ?? ""} onChange={(e) => setBudget(e.target.value ? Number(e.target.value) : null)} className="rounded-lg border border-line bg-surface px-2 py-2 text-sm">
            <option value="">Any budget</option>
            {[400, 700, 1000, 1500, 2000, 3000, 5000].map((b) => (
              <option key={b} value={b}>Up to {sym}{b.toLocaleString("en-US")}</option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-subtle">Uses today&apos;s lowest price where we have one, else the launch price.</span>
        </label>
      </div>
      {use && (
        <section aria-live="polite">
          <h2 className="h-section mb-1">{results.length ? `Matches for ${USES[use].label.toLowerCase()}` : "Nothing matches all of that"}</h2>
          <p className="mb-4 text-sm text-muted">Ranked only by the specs listed under each camera. Nobody pays to appear here.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {results.map(({ c, reasons }) => (
              <div key={c.slug} className="flex flex-col gap-1">
                <ProductCard p={c} market={market} />
                <ul className="flex flex-wrap gap-1">
                  {reasons.map((r) => (
                    <li key={r} className="chip text-[10px]">✓ {r}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
