import Link from "next/link";

/** Home section heading: a small eyebrow, the title, an optional "all" link. */
export default function SectionHeading({ eyebrow, title, href, link, id }: { eyebrow: string; title: string; href?: string; link?: string; id?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id} className="h-section mt-1 leading-tight">{title}</h2>
      </div>
      {href && link && (
        <Link href={href} prefetch={false} className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold no-underline hover:bg-accent-soft hover:no-underline">
          {link} <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  );
}
