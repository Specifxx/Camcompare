import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdSlot from "@/components/AdSlot";
import { AD_SLOTS } from "@/lib/ads";
import { guide, guides } from "@/lib/guides";
import { breadcrumb, ldJson } from "@/lib/jsonld";
import { abs, SITE_NAME } from "@/lib/site";

export const dynamicParams = false;
export const generateStaticParams = () => guides().map((g) => ({ slug: g.slug }));

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const g = guide(params.slug);
  if (!g) return {};
  return { title: g.title, description: g.description, alternates: { canonical: `/guides/${g.slug}` }, openGraph: { title: g.title, description: g.description, type: "article", url: `/guides/${g.slug}` } };
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const g = guide(params.slug);
  if (!g) notFound();
  const others = guides().filter((x) => x.slug !== g.slug);
  return (
    <article className="mx-auto max-w-3xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson({ "@context": "https://schema.org", "@type": "Article", headline: g.title, description: g.description, dateModified: g.updated, author: { "@type": "Organization", name: SITE_NAME }, publisher: { "@type": "Organization", name: SITE_NAME }, mainEntityOfPage: abs(`/guides/${g.slug}`) })}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Guides", path: "/guides" }, { name: g.title, path: `/guides/${g.slug}` }]))} />
      <nav className="mb-4 text-xs text-subtle">
        <Link prefetch={false} href="/guides">Guides</Link> / <span>{g.title}</span>
      </nav>
      <h1 className="text-3xl font-extrabold tracking-tight">{g.title}</h1>
      {g.updated && <p className="mt-1 text-xs text-subtle">Updated {g.updated} · {Math.max(1, Math.round(g.words / 220))} min read</p>}
      <div className="prose-cc mt-6" dangerouslySetInnerHTML={{ __html: g.html }} />
      <AdSlot slot={AD_SLOTS.article} />
      {others.length > 0 && (
        <aside className="mt-10 border-t border-line pt-6">
          <h2 className="h-section mb-3">More guides</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {others.map((o) => (
              <li key={o.slug}>
                <Link prefetch={false} href={`/guides/${o.slug}`}>{o.title}</Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </article>
  );
}
