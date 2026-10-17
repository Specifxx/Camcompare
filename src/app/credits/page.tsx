import type { Metadata } from "next";
import Link from "next/link";
import { credit, productPath, publishedCameras, publishedLenses } from "@/lib/catalog";

export const metadata: Metadata = { title: "Photo credits", alternates: { canonical: "/credits" } };

export default function Credits() {
  const rows = [...publishedCameras().map((c) => ({ kind: "camera" as const, p: c })), ...publishedLenses().map((l) => ({ kind: "lens" as const, p: l }))]
    .map((r) => ({ ...r, cr: credit(r.p.slug)! }))
    .sort((a, b) => a.p.name.localeCompare(b.p.name));
  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-2xl font-extrabold tracking-tight">Photo credits</h1>
      <p className="mb-6 text-sm text-muted">Product photos are from Wikimedia Commons and Openverse (mostly Flickr) under the licences listed, unless marked as a press image. Photos are resized; nothing else is changed.</p>
      <ul className="divide-y divide-line text-sm">
        {rows.map(({ kind, p, cr }) => (
          <li key={p.slug} className="py-2">
            <Link href={productPath({ kind, slug: p.slug })} className="font-medium">{p.name}</Link>:{" "}
            <a href={cr.pageUrl} rel="nofollow noopener" target="_blank">{cr.file.length > 80 ? `${cr.file.slice(0, 77)}…` : cr.file}</a> by {cr.author}, {cr.licenseUrl ? <a href={cr.licenseUrl} rel="nofollow noopener" target="_blank">{cr.license}</a> : cr.license}
            {cr.source === "press" ? " (press image)" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
