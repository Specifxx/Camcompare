import { brandName } from "@/lib/catalog";
import type { Camera, Lens } from "@/lib/catalog/schema";
import { reviewLinks } from "@/lib/reviews";
import LinkGrid from "./LinkGrid";
import MemberReviews from "./MemberReviews";

/**
 * Reviews: our members' first (stars, histogram, what they mention, the
 * reviews themselves), then where to read the critics (ReviewHub's links to
 * each site's own search; nothing copied). Videos and Reddit have their own
 * sections, so they are left out of the critics' list here.
 */
export default function ProductReviews({ p, kind, name }: { p: Camera | Lens; kind: "camera" | "lens"; name: string }) {
  const critics = reviewLinks(p, brandName(p.brand), kind)
    .filter((l) => l.site !== "YouTube" && !l.site.startsWith("Reddit"))
    .map((l) => ({ label: l.site, note: l.note, href: l.href }));
  return (
    <section id="reviews" className="scroll-mt-28" aria-labelledby="reviews-h">
      <h2 id="reviews-h" className="h-section mb-3">
        Reviews
      </h2>
      <MemberReviews slug={p.slug} kind={kind} name={name} />
      <div className="mt-6">
        <h3 className="mb-1 font-bold">Expert reviews</h3>
        <p className="mb-3 text-sm text-muted">Each link opens that site&apos;s own search for the {name}.</p>
        <LinkGrid links={critics} icon="read" />
      </div>
    </section>
  );
}
