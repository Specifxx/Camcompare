// Key specs as callout tiles: an icon, the value large, a short label. Built
// by lib/highlights.ts from catalog facts only; a null spec has no tile.
// No server imports: the quick view renders it too.
import type { Highlight, HighlightIcon } from "@/lib/highlights";

const PATHS: Record<HighlightIcon, React.ReactNode> = {
  sensor: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <rect x="8" y="9" width="8" height="6" rx="1" />
    </>
  ),
  lens: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 3.5v2M12 18.5v2" />
    </>
  ),
  stabilise: (
    <>
      <rect x="8" y="4.5" width="8" height="15" rx="1.5" />
      <path d="M4.5 8.5v7M19.5 8.5v7M2 10.5v3M22 10.5v3" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6.5" width="12.5" height="11" rx="2" />
      <path d="m15.5 10.5 5.5-3v9l-5.5-3z" />
    </>
  ),
  focus: (
    <>
      <path d="M4 8.5V5a1 1 0 0 1 1-1h3.5M15.5 4H19a1 1 0 0 1 1 1v3.5M20 15.5V19a1 1 0 0 1-1 1h-3.5M8.5 20H5a1 1 0 0 1-1-1v-3.5" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  viewfinder: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  burst: (
    <>
      <rect x="8" y="8" width="12.5" height="10.5" rx="1.5" />
      <path d="M5 15.5V6.5A1.5 1.5 0 0 1 6.5 5H16" />
      <path d="M2.5 12.5V4A1.5 1.5 0 0 1 4 2.5h8.5" opacity=".6" />
    </>
  ),
  weight: (
    <>
      <circle cx="12" cy="6" r="2.5" />
      <path d="M7 9h10l2.5 11.5h-15z" />
    </>
  ),
  sealed: <path d="M12 3.5s6 6.4 6 10.6a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z" />,
  water: <path d="M3 9.5c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0M3 15c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0" />,
  aperture: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m14.1 8.3 4.8 8.4M9.9 8.3h9.7M7.8 12l4.9-8.4M9.9 15.7 5.1 7.3M14.1 15.7H4.4M16.2 12l-4.9 8.4" />
    </>
  ),
  motor: <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z" />,
  macro: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20.5 20.5-5.2-5.2M10.5 7.5v6M7.5 10.5h6" />
    </>
  ),
};

export function HighlightIcon({ name, className = "h-5 w-5" }: { name: HighlightIcon; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {PATHS[name]}
    </svg>
  );
}

/**
 * `compact` for the quick view: smaller tiles, same facts. The grid is two
 * columns on a phone and four from `sm` (or `cols` to override). A screen
 * reader hears "In-body stabilisation: 5.5 stops, CIPA rating".
 */
export default function SpecHighlights({ items, compact = false, className = "", cols = "grid-cols-2 sm:grid-cols-4", label = "Key specs" }: { items: Highlight[]; compact?: boolean; className?: string; cols?: string; label?: string }) {
  if (!items.length) return null;
  return (
    <ul aria-label={label} className={`grid gap-2 ${compact ? "" : "sm:gap-3"} ${cols} ${className}`}>
      {items.map((h) => (
        <li key={h.key} className={`flex items-start gap-2.5 rounded-xl border border-line ${compact ? "bg-raised/60 p-2.5" : "bg-surface p-3"}`} title={h.detail}>
          <span className={`grid shrink-0 place-items-center rounded-lg ${compact ? "h-8 w-8" : "h-9 w-9"} ${h.off ? "bg-raised text-subtle" : "bg-accent-soft text-accent"}`}>
            <HighlightIcon name={h.icon} className={compact ? "h-[18px] w-[18px]" : "h-5 w-5"} />
          </span>
          <span className="min-w-0">
            <span className={`block font-bold leading-tight tracking-tight ${compact ? "text-[15px]" : "text-base sm:text-lg"} ${h.off ? "text-muted" : "text-fg"}`}>
              <span className="sr-only">{h.label}: </span>
              {h.value}
              {h.detail && <span className="sr-only">, {h.detail}</span>}
            </span>
            <span aria-hidden className="block text-xs leading-snug text-muted">{h.label}</span>
            {h.detail && <span aria-hidden className={`block text-[11px] leading-snug text-subtle ${compact ? "line-clamp-1" : "line-clamp-2"}`}>{h.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
