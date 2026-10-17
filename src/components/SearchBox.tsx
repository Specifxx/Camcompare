"use client";
// Site-wide instant search over /search-index.json (built from the catalog
// by scripts/build-public-data.ts, ~1,000 rows). Loaded on first focus only.
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { marketPath, type MarketCode } from "@/lib/markets";
import { searchRank, type SearchRow } from "@/lib/search";

export default function SearchBox({ market }: { market: MarketCode }) {
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
  const go = (r: SearchRow) => {
    setOpen(false);
    setQ("");
    router.push(marketPath(market, `/${r.k === "c" ? "cameras" : "lenses"}/${r.s}`));
  };

  return (
    <div ref={box} className="relative min-w-0 flex-1 md:w-64 md:flex-none">
      <input
        type="search"
        value={q}
        placeholder="Search cameras & lenses"
        aria-label="Search cameras and lenses"
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-controls="site-search-results"
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
        className="w-full rounded-lg border border-line bg-raised px-3 py-1.5 text-sm"
      />
      {open && hits.length > 0 && (
        <ul id="site-search-results" role="listbox" className="absolute right-0 z-40 mt-1 w-[min(22rem,90vw)] overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          {hits.map((r, i) => (
            <li key={r.s} role="option" aria-selected={i === active}>
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
