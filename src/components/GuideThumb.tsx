import { postSlugs } from "@/lib/guide-blocks";
import type { Guide } from "@/lib/guides";
import { hasLicensedThumb } from "@/lib/images";

// Fanned photo cards on a post's thumbnail, the first in front. Positions for one, two and three photos.
const FAN: Record<number, { left: string; top: string; w: string; rot: string; z: number }[]> = {
  1: [{ left: "30%", top: "14%", w: "40%", rot: "-3deg", z: 3 }],
  2: [
    { left: "44%", top: "18%", w: "36%", rot: "4deg", z: 3 },
    { left: "20%", top: "10%", w: "34%", rot: "-6deg", z: 2 },
  ],
  3: [
    { left: "33%", top: "20%", w: "34%", rot: "-2deg", z: 3 },
    { left: "10%", top: "8%", w: "30%", rot: "-9deg", z: 2 },
    { left: "60%", top: "8%", w: "30%", rot: "8deg", z: 1 },
  ],
};

const IRIS = [
  ["M21.65 14.59L30.53 19.71A15 15 0 0 1 21.65 29.9Z", "#ffffff"],
  ["M20.05 20.19L20.05 30.44A15 15 0 0 1 6.79 27.84Z", "#e3e9ff"],
  ["M14.4 21.6L5.52 26.73A15 15 0 0 1 1.14 13.95Z", "#c7d5ff"],
  ["M10.35 17.41L1.47 12.29A15 15 0 0 1 10.35 2.1Z", "#ffffff"],
  ["M11.95 11.81L11.95 1.56A15 15 0 0 1 25.21 4.16Z", "#e3e9ff"],
  ["M17.6 10.4L26.48 5.27A15 15 0 0 1 30.86 18.05Z", "#86efac"],
];

/**
 * A post's picture on its card (home page, /guides): the brand gradient with up to three of
 * the post's own products as fanned photo cards (licensed photos only), and a "Blog" or
 * "Guide" badge. A post with no product photo shows the logo's iris instead.
 */
export function GuideThumb({ g, className = "" }: { g: Guide; className?: string }) {
  const photos = postSlugs(g).filter(hasLicensedThumb).slice(0, 3);
  const fan = FAN[photos.length] ?? [];
  return (
    <span className={`relative block overflow-hidden bg-gradient-to-br from-[#0b1f6b] via-[#1d47d1] to-[#4a82ff] ${className}`}>
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
      <span aria-hidden className="pointer-events-none absolute -bottom-20 left-6 h-40 w-40 rounded-full bg-[#22c55e]/30 blur-2xl" />
      {photos.length ? (
        photos.map((slug, i) => (
          <span
            key={slug}
            className="absolute block aspect-square rounded-xl bg-white p-[3%] shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
            style={{ left: fan[i].left, top: fan[i].top, width: fan[i].w, transform: `rotate(${fan[i].rot})`, zIndex: fan[i].z }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static licensed thumbnails; no optimiser */}
            <img src={`/products/${slug}.webp`} alt="" loading="lazy" className="h-full w-full object-contain" />
          </span>
        ))
      ) : (
        <svg aria-hidden viewBox="0 0 32 32" className="absolute left-1/2 top-1/2 h-1/2 -translate-x-1/2 -translate-y-1/2 opacity-90">
          {IRIS.map(([d, fill]) => (
            <path key={d} d={d} fill={fill} />
          ))}
        </svg>
      )}
      <span className="absolute left-3 top-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[#0b1f6b] shadow-sm backdrop-blur">{g.kind === "blog" ? "Blog" : "Guide"}</span>
    </span>
  );
}
