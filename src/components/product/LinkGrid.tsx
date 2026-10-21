import type { MediaLink } from "@/lib/media-links";

const ICON = {
  play: <path d="M9 7.5v9l7.5-4.5z" fill="currentColor" stroke="none" />,
  chat: <path d="M5 6.5h14v9H10l-4 3v-3H5z" />,
  read: <path d="M5 5.5h6.5a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 0-1.5-1.5H5zM19 5.5h-4.5A1.5 1.5 0 0 0 13 7v11a1.5 1.5 0 0 1 1.5-1.5H19z" />,
};

/** External links as small tiles: an icon, the label, a note. Each opens the other site's own page; nothing is copied. */
export default function LinkGrid({ links, icon }: { links: MediaLink[]; icon: keyof typeof ICON }) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {links.map((l) => (
        <li key={l.href}>
          <a href={l.href} target="_blank" rel="noopener noreferrer nofollow" className="card card-hover flex h-full items-center gap-3 px-3 py-2.5 text-fg no-underline hover:no-underline">
            <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
                {ICON[icon]}
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{l.label}</span>
              <span className="block truncate text-xs text-subtle">{l.note}</span>
            </span>
            <span aria-hidden className="ml-auto text-subtle">↗</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
