import type { Metadata } from "next";
import Link from "next/link";
import { credit, publishedCameras } from "@/lib/catalog";


export const metadata: Metadata = { title: "Photo credits", alternates: { canonical: "/credits" } };

export default function Credits() {
  const rows = publishedCameras().map((c) => ({ c, cr: credit(c.slug)! })).sort((a, b) => a.c.name.localeCompare(b.c.name));
  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-2xl font-extrabold tracking-tight">Photo credits</h1>
      <p className="mb-6 text-sm text-muted">Camera photos are from Wikimedia Commons under the licences listed, unless marked as a press image.</p>
      <ul className="divide-y divide-line text-sm">
        {rows.map(({ c, cr }) => (
          <li key={c.slug} className="py-2">
            <Link href={`/cameras/${c.slug}`} className="font-medium">{c.name}</Link>:{" "}
            <a href={cr.pageUrl} rel="nofollow noopener" target="_blank">{cr.file}</a> by {cr.author}, {cr.licenseUrl ? <a href={cr.licenseUrl} rel="nofollow noopener" target="_blank">{cr.license}</a> : cr.license}
            {cr.source === "press" ? " (press image)" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
