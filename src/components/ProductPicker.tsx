"use client";
// Pick a catalog camera or lens by typing, over the same /search-index.json
// the header search uses (fetched once per page, only when a picker mounts).
// Used by the story editor (products a story is about) and My gear.
import { useEffect, useId, useMemo, useState } from "react";
import { searchRank, type SearchRow } from "@/lib/search";
import { thumbSrc } from "@/lib/thumb";

let index: Promise<SearchRow[]> | null = null;
export function loadIndex(): Promise<SearchRow[]> {
  index ??= fetch("/search-index.json")
    .then((r) => (r.ok ? (r.json() as Promise<SearchRow[]>) : []))
    .catch(() => {
      index = null;
      return [];
    });
  return index;
}

/** The search index as a slug → row map, once loaded (empty until then). */
export function useCatalogIndex(): Map<string, SearchRow> {
  const [rows, setRows] = useState<SearchRow[]>([]);
  useEffect(() => {
    let live = true;
    void loadIndex().then((r) => live && setRows(r));
    return () => {
      live = false;
    };
  }, []);
  return useMemo(() => new Map(rows.map((r) => [r.s, r])), [rows]);
}

export const productHref = (r: Pick<SearchRow, "s" | "k">, prefix = "") => `${prefix}/${r.k === "c" ? "cameras" : "lenses"}/${r.s}`;

export default function ProductPicker({ onPick, exclude = [], placeholder = "Search cameras and lenses", label }: { onPick: (row: SearchRow) => void; exclude?: string[]; placeholder?: string; label: string }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SearchRow[] | null>(null);
  const [active, setActive] = useState(0);
  const id = useId();
  useEffect(() => {
    if (q.trim() && !rows) void loadIndex().then(setRows);
  }, [q, rows]);
  const hits = useMemo(() => (rows && q.trim() ? searchRank(rows, q).filter((r) => !exclude.includes(r.s)).slice(0, 8) : []), [rows, q, exclude]);
  const pick = (r: SearchRow) => {
    onPick(r);
    setQ("");
    setActive(0);
  };
  return (
    <div className="relative">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, hits.length - 1));
          else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          else if (e.key === "Enter" && hits[active]) {
            e.preventDefault();
            pick(hits[active]);
          } else if (e.key === "Escape") setQ("");
        }}
        role="combobox"
        aria-expanded={hits.length > 0}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        className="mt-1 w-full rounded border border-line bg-surface px-2 py-1.5 text-sm text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
      />
      {hits.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-auto rounded border border-line bg-surface shadow-lift">
          {hits.map((r, i) => (
            <li key={r.s} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r)} className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm ${i === active ? "bg-raised" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbSrc(r.s)} alt="" width={40} height={30} loading="lazy" className="h-[30px] w-10 shrink-0 rounded bg-white object-contain" />
                <span className="min-w-0 flex-1 truncate">{r.n}</span>
                <span className="text-xs text-subtle">
                  {r.k === "c" ? "camera" : "lens"} · {r.y}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
