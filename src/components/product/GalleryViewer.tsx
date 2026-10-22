"use client";
// More than one licensed photo (lib/gallery.ts): the chosen one large, the
// rest as buttons under it. Static files, `unoptimized` like every thumbnail.
import Image from "next/image";
import { useState } from "react";
import PhotoCredit from "@/components/PhotoCredit";
import type { GalleryImage } from "@/lib/gallery";

export default function GalleryViewer({ images }: { images: GalleryImage[] }) {
  const [i, setI] = useState(0);
  const cur = images[i];
  return (
    <figure>
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-white">
        <Image src={cur.src} alt={cur.alt} fill unoptimized priority={i === 0} sizes="(max-width: 768px) 100vw, 360px" className="object-contain p-2" />
      </div>
      <PhotoCredit credit={cur.credit} store={cur.store} />
      <ul className="mt-2 flex gap-2 overflow-x-auto" aria-label="Photos">
        {images.map((im, k) => (
          <li key={im.src} className="shrink-0">
            <button type="button" onClick={() => setI(k)} aria-pressed={k === i} aria-label={`Photo ${k + 1}: ${im.alt}`} className={`relative block h-14 w-[4.5rem] overflow-hidden rounded-md border bg-white ${k === i ? "border-accent ring-2 ring-accent/30" : "border-line"}`}>
              <Image src={im.src} alt="" fill unoptimized sizes="72px" className="object-contain p-1" />
            </button>
          </li>
        ))}
      </ul>
    </figure>
  );
}
