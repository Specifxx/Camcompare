import Image from "next/image";
import { thumbSrc } from "@/lib/thumb";

// Static WebPs, already sized by scripts/fetch-thumbnails.ts: `unoptimized`
// keeps them off Vercel's paid image optimiser.
export default function ProductThumb({ slug, alt, priority, className = "" }: { slug: string; alt: string; priority?: boolean; className?: string }) {
  return (
    <div className={`relative aspect-[4/3] overflow-hidden rounded-lg bg-white ${className}`}>
      <Image src={thumbSrc(slug)} alt={alt} fill unoptimized priority={priority} sizes="(max-width: 640px) 50vw, 320px" className="object-contain p-2" />
    </div>
  );
}
