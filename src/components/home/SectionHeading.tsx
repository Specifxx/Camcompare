import Link from "next/link";

/** Home section heading: a small eyebrow, the title, an optional "all" link. */
export default function SectionHeading({ eyebrow, title, href, link, id }: { eyebrow: string; title: string; href?: string; link?: string; id?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-subtle">{eyebrow}</p>
        <h2 id={id} className="mt-1 text-xl font-semibold leading-tight sm:text-2xl">{title}</h2>
      </div>
      {href && link && (
        <Link href={href} prefetch={false} className="shrink-0 text-sm font-semibold">
          {link}
        </Link>
      )}
    </div>
  );
}
