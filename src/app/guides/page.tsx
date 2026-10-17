import type { Metadata } from "next";
import Link from "next/link";
import { guides } from "@/lib/guides";

export const metadata: Metadata = { title: "Camera buying guides", description: "Plain-language guides to sensor sizes, lens mounts, lens names, buying used, grey imports and when prices drop.", alternates: { canonical: "/guides" } };

export default function GuidesIndex() {
  const list = guides();
  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-2xl font-extrabold tracking-tight">Guides</h1>
      <p className="mb-6 text-sm text-muted">The background that makes the specs and prices easier to read. Checked against makers&apos; documentation.</p>
      <ul className="flex flex-col gap-3">
        {list.map((g) => (
          <li key={g.slug}>
            <Link prefetch={false} href={`/guides/${g.slug}`} className="card block p-4 text-fg no-underline hover:border-accent hover:no-underline">
              <span className="block font-semibold">{g.title}</span>
              <span className="text-sm text-muted">{g.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
