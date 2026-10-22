import type { Metadata } from "next";
import Link from "next/link";
import { credit, productPath, publishedCameras, publishedLenses, storePhoto } from "@/lib/catalog";

export const metadata: Metadata = { title: "Photo credits", alternates: { canonical: "/credits" } };

export default function Credits() {
  const all = [...publishedCameras().map((c) => ({ kind: "camera" as const, p: c })), ...publishedLenses().map((l) => ({ kind: "lens" as const, p: l }))].sort((a, b) => a.p.name.localeCompare(b.p.name));
  // A product with no licensed photo shows a store's own listing photo (lib/store-photos.ts): credited to the store.
  const rows = all.flatMap((r) => {
    const cr = credit(r.p.slug);
    return cr ? [{ ...r, cr }] : [];
  });
  const stores = all.flatMap((r) => {
    const sp = credit(r.p.slug) ? null : storePhoto(r.p.slug);
    return sp ? [{ ...r, store: sp.store }] : [];
  });
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
      {stores.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-lg font-bold">Store photos</h2>
          <p className="mb-3 text-sm text-muted">Until we have a licensed photo of these, they show the photo a store uses for its own listing, loaded from that store and credited to it.</p>
          <ul className="divide-y divide-line text-sm">
            {stores.map(({ kind, p, store }) => (
              <li key={p.slug} className="py-2">
                <Link href={productPath({ kind, slug: p.slug })} className="font-medium">{p.name}</Link>: image from {store}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
