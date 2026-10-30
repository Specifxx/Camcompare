import type { Metadata } from "next";
import Link from "next/link";
import { GuideThumb } from "@/components/GuideThumb";
import { latestGuides, type Guide } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Camera blog and buying guides",
  description: "The best cameras, drones and lenses of 2026 with today's prices, plus plain-language guides to sensor sizes, lens mounts, buying used and when prices drop.",
  alternates: { canonical: "/guides" },
};

function List({ list }: { list: Guide[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((g) => (
        <li key={g.slug}>
          <Link href={`/guides/${g.slug}`} className="card group flex h-full flex-col overflow-hidden text-fg no-underline transition hover:-translate-y-0.5 hover:border-accent hover:no-underline">
            <GuideThumb g={g} className="aspect-[16/9]" />
            <span className="flex flex-1 flex-col p-4">
              <span className="block font-display text-lg font-bold leading-snug group-hover:text-accent">{g.title}</span>
              <span className="mt-1 line-clamp-2 text-sm text-muted">{g.description}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function GuidesIndex() {
  const all = latestGuides();
  const posts = all.filter((g) => g.kind === "blog");
  const guides = all.filter((g) => g.kind === "guide");
  return (
    <div className="max-w-6xl">
      <h1 className="mb-2 text-2xl font-extrabold tracking-tight">Blog and buying guides</h1>
      <p className="mb-6 text-sm text-muted">Best-of lists with today&apos;s prices from the stores we check, and the background that makes the specs easier to read. Specs come from makers&apos; spec sheets.</p>
      {posts.length > 0 && (
        <section aria-labelledby="posts-h" className="mb-10">
          <h2 id="posts-h" className="h-section mb-3">Best of 2026, with live prices</h2>
          <List list={posts} />
        </section>
      )}
      <section aria-labelledby="guides-h">
        <h2 id="guides-h" className="h-section mb-3">Buying guides</h2>
        <List list={guides} />
      </section>
    </div>
  );
}
