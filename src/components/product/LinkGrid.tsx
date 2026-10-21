import type { MediaLink } from "@/lib/media-links";

// The kind of link, for the left rule's colour later; one look today (kept small: a page has a dozen).
type Kind = "play" | "chat" | "read";

/** External links as small tiles: the label and a note. Each opens the other site's own page; nothing is copied. */
export default function LinkGrid({ links }: { links: MediaLink[]; icon?: Kind }) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {links.map((l) => (
        <li key={l.href}>
          <a href={l.href} target="_blank" rel="noopener noreferrer nofollow" className="card card-hover flex h-full items-center gap-3 border-l-2 border-l-accent/60 px-3 py-2 text-fg no-underline hover:no-underline">
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
