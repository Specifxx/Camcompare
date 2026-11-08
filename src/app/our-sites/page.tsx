import type { Metadata } from "next";
import { FAMILY_SITES, NETWORK_PAGE } from "@/lib/family-network";
import { SITE_NAME } from "@/lib/site";

// The one page that links the owner's other sites (2026-11-08, DECISIONS.md "One Our sites page instead of footer
// cross-links"): every footer links here once, and this page links each site once, by its plain name, instead of a
// site-wide link from every page to another of our domains. Static, like every page.
export const metadata: Metadata = {
  title: "Our other sites",
  description: `${SITE_NAME} is one of the Compare Empire price comparison sites. The others compare card games, hobby and tech prices the same way.`,
  alternates: { canonical: "/our-sites" },
};

export default function OurSites() {
  const sites = FAMILY_SITES.filter((s) => s.id !== "cam");
  return (
    <div className="max-w-2xl space-y-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-extrabold tracking-tight">Our other sites</h1>
      <p>{SITE_NAME} is one of the Compare Empire sites: independent price comparison, the same rules on every site, no paid ranking.</p>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {sites.map((s) => (
          <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
            <a href={s.url} rel="noopener" className="font-semibold text-fg">
              {s.name}
            </a>
            <span className="text-muted">{s.label}</span>
          </li>
        ))}
      </ul>
      <p>
        <a href={NETWORK_PAGE} rel="noopener">Every Compare Empire site →</a>
      </p>
    </div>
  );
}
