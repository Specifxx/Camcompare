import type { Camera, Lens } from "@/lib/catalog/schema";
import { brandName } from "@/lib/catalog";
import { reviewLinks } from "@/lib/reviews";

/** Where to read reviews: a plain list of links to each site's own search. Nothing copied. */
export default function ReviewHub({ p, kind }: { p: Camera | Lens; kind: "camera" | "lens" }) {
  const links = reviewLinks(p, brandName(p.brand), kind);
  return (
    <section>
      <h2 className="h-section mb-1">Reviews</h2>
      <p className="mb-3 text-sm text-muted">Read what reviewers found. Each link opens that site&apos;s search for the {p.shortName}.</p>
      <ul className="divide-y divide-line rounded border border-line text-sm">
        {links.map((l) => (
          <li key={l.site} className="flex items-baseline justify-between gap-3 px-3 py-2">
            <a href={l.href} target="_blank" rel="noopener noreferrer" className="font-semibold">
              {l.site}
            </a>
            <span className="text-right text-xs text-muted">{l.note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
