import Link from "next/link";


/** Home section heading: a film-edge eyebrow, display title with a grease-pencil underline, optional "all" link. */
export default function SectionHeading({ eyebrow, title, href, link, id }: { eyebrow: string; title: string; href?: string; link?: string; id?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="eyebrow flex items-center gap-2">
          <span aria-hidden className="text-spark">▶</span>
          {eyebrow}
        </p>
        <h2 id={id} className="mt-1.5 text-[1.65rem] font-semibold leading-tight tracking-[-0.015em] sm:text-[2rem]">{title}</h2>
        <svg aria-hidden viewBox="0 0 64 8" className="cc-mark mt-1.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M2 5.5C12 2.5 20 2 30 4s20 2.5 32-1.5" />
        </svg>
      </div>
      {href && link && (
        <Link href={href} prefetch={false} className="group shrink-0 font-mono text-xs font-semibold uppercase tracking-[0.08em] no-underline hover:no-underline">
          {link} <span aria-hidden className="inline-block transition-transform group-hover:translate-x-1">→</span>
        </Link>
      )}
    </div>
  );
}
