import Link from "next/link";
import Reveal from "@/components/Reveal";

/** Home section heading: eyebrow, display title with a brand rule, optional "all" link. */
export default function SectionHeading({ eyebrow, title, href, link, id }: { eyebrow: string; title: string; href?: string; link?: string; id?: string }) {
  return (
    <Reveal className="mb-5 flex items-end justify-between gap-4">
      <div>
        <p className="eyebrow flex items-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-spark" />
          {eyebrow}
        </p>
        <h2 id={id} className="mt-2 text-2xl font-bold tracking-tight sm:text-[1.7rem]">{title}</h2>
        <div aria-hidden className="mt-3 h-0.5 w-12 rounded-full bg-gradient-to-r from-accent to-spark" />
      </div>
      {href && link && (
        <Link href={href} prefetch={false} className="group shrink-0 text-sm font-semibold no-underline hover:no-underline">
          {link} <span aria-hidden className="inline-block transition-transform group-hover:translate-x-1">→</span>
        </Link>
      )}
    </Reveal>
  );
}
