import { thumbSrc } from "@/lib/thumb";

// Static WebPs, already sized by scripts/fetch-thumbnails.ts. A plain <img>:
// next/image added nothing here (it was `unoptimized`, off Vercel's paid image
// optimiser) but an inline style and its props on every card, in the HTML and
// again in the RSC payload. Same box and fit as before.
export default function ProductThumb({ slug, alt, priority, className = "" }: { slug: string; alt: string; priority?: boolean; className?: string }) {
  return (
    <div className={`relative aspect-[4/3] overflow-hidden rounded-lg bg-white ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumbSrc(slug)} alt={alt} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async" className="absolute inset-0 h-full w-full object-contain p-2" />
    </div>
  );
}
