"use client";
// Site-wide instant search over /search-index.json (built from the catalog
// by scripts/build-public-data.ts, ~1,000 rows). Loaded on first focus only.
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { marketPath, type MarketCode } from "@/lib/markets";
import { searchRank, type SearchRow } from "@/lib/search";

// variant "hero": the home hero's big box (styling only; same search).
export default function SearchBox({ market, variant = "header", placeholder = "Search cameras & lenses" }: { market: MarketCode; variant?: "header" | "hero"; placeholder?: string }) {
  const hero = variant === "hero";
  const ids = hero ? "hero-search" : "site-search";
  const router = useRouter();
  const [rows, setRows] = useState<SearchRow[] | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const load = () => {
    if (rows) return;
    fetch("/search-index.json")
      .then((r) => r.json())
      .then((d: SearchRow[]) => setRows(d))
      .catch(() => setRows([]));
  };
  const hits = useMemo(() => (rows && q.trim().length >= 2 ? searchRank(rows, q).slice(0, 8) : []), [rows, q]);
  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const listed = open && hits.length > 0;
  const go = (r: SearchRow) => {
    setOpen(false);
    setQ("");
    router.push(marketPath(market, `/${r.k === "c" ? "cameras" : "lenses"}/${r.s}`));
  };

  return (
    <div ref={box} className={hero ? "relative w-full" : "relative min-w-0 flex-1 md:w-64 md:flex-none"}>
      {hero && (
        <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-subtle" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      )}
      <input
        type="search"
        value={q}
        placeholder={placeholder}
        aria-label="Search cameras and lenses"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={listed}
        aria-controls={listed ? `${ids}-results` : undefined}
        aria-activedescendant={listed && hits[active] ? `${ids}-opt-${active}` : undefined}
        onFocus={() => {
          load();
          setOpen(true);
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, hits.length - 1));
          else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          else if (e.key === "Enter" && hits[active]) go(hits[active]);
          else if (e.key === "Escape") setOpen(false);
        }}
        className={
          hero
            ? "h-14 w-full rounded-2xl border border-line bg-surface/85 pl-12 pr-4 text-base shadow-lift outline-none backdrop-blur transition-colors placeholder:text-subtle focus:border-accent"
            : "w-full rounded-lg border border-line bg-raised/80 px-3 py-1.5 text-sm transition-colors focus:border-accent focus:bg-surface"
        }
      />
      {/* On a phone the box is narrow and right of centre, so the list spans the
          screen under the header row instead of hanging off the box's right edge. */}
      {listed && (
        <ul
          id={`${ids}-results`}
          role="listbox"
          className={
            hero
              ? "absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-line bg-surface text-left shadow-lift"
              : "fixed inset-x-4 top-14 z-40 mt-1 overflow-hidden rounded-lg border border-line bg-surface shadow-lg md:absolute md:inset-x-auto md:right-0 md:top-auto md:w-[22rem]"
          }
        >
          {hits.map((r, i) => (
            <li key={r.s} id={`${ids}-opt-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(r)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${i === active ? "bg-raised" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/products/${r.s}.webp`} alt="" width={48} height={36} className="h-9 w-12 shrink-0 rounded bg-white object-contain" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.n}</span>
                  <span className="text-xs text-subtle">{r.k === "c" ? "Camera" : "Lens"} · {r.y}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
