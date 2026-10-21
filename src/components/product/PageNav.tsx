/**
 * The page's own contents, for a long product page: plain anchors (no
 * script), a row that scrolls sideways on a phone and sticks under the
 * header on a wide screen.
 */
export default function PageNav({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav aria-label="On this page" className="cc-pagenav -mx-4 border-y border-line bg-bg/95 px-4 backdrop-blur lg:sticky lg:top-14 lg:z-20">
      <ul className="flex gap-1 overflow-x-auto py-1.5 text-sm">
        {items.map((i) => (
          <li key={i.id} className="shrink-0">
            <a href={`#${i.id}`} className="block rounded-md px-2.5 py-1.5 font-medium text-muted no-underline hover:bg-raised hover:text-fg hover:no-underline">
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
