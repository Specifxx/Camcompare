import type { Metadata } from "next";
import Link from "next/link";
import { brands, publishedCameras } from "@/lib/catalog";


export const metadata: Metadata = { title: "Camera brands", alternates: { canonical: "/brands" } };

export default function BrandsPage() {
  const cams = publishedCameras();
  const list = brands().map((b) => ({ ...b, n: cams.filter((c) => c.brand === b.slug).length })).filter((b) => b.n > 0);
  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight">Camera brands</h1>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((b) => (
          <li key={b.slug}>
            <Link href={`/brands/${b.slug}`} className="card flex items-center justify-between p-4 text-fg no-underline hover:border-accent hover:no-underline">
              <span className="font-semibold">{b.name}</span>
              <span className="text-sm text-subtle">{b.n} camera{b.n === 1 ? "" : "s"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
