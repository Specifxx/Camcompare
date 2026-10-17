// CamCompare mark: a six-blade iris. Rust (film-stock warm) is the brand; the one amber blade is
// the "spark" (the best price). Geometry: each blade is a 60° cone whose apex
// sits on a hexagon round the centre, clipped to the circle; the six cones are
// the same shape turned 60° apart, and the parallel gaps between them come
// from the apexes being off-centre.
//
// Motion is transforms only (globals.css, "Iris"), so it runs the same in
// Safari/iOS, Firefox, Chrome and Android: on load every blade's apex slides
// out from the centre (one translate, the same in each blade's own turned
// frame), so the iris opens once, quickly; under reduced motion it is still.
// (It used to animate the CSS `d` property, which Safari does not support.)
import { useId } from "react";
import { SITE_NAME } from "@/lib/site";

// Blade 0 in its own frame: apex at (21.65, 14.59), edges at 30° and 90°,
// long enough to reach past the rim from the closed position (the clip trims it).
const BLADE = "M21.65 14.59L56.29 34.59L21.65 54.59Z";
// Lit from the upper left: darkest blade lower right; blade 5 is the spark.
const FILL = ["var(--iris-0)", "var(--iris-1)", "var(--iris-2)", "var(--iris-3)", "var(--iris-4)", "var(--iris-spark)"];

export function LogoMark({ size = 28, intro = false, className = "" }: { size?: number; intro?: boolean; className?: string }) {
  const clip = `cc-iris-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 32 32" className={`cc-iris${intro ? " cc-iris-intro" : ""} shrink-0 ${className}`}>
      <defs>
        <clipPath id={clip}>
          <circle cx="16" cy="16" r="15" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {FILL.map((fill, i) => (
          <g key={i} transform={`rotate(${60 * i} 16 16)`}>
            <path className="cc-blade" d={BLADE} style={{ fill }} />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Mark + wordmark. `compact` hides the wordmark below sm. */
export default function Logo({ size = 28, compact = false, intro = false, className = "" }: { size?: number; compact?: boolean; intro?: boolean; className?: string }) {
  return (
    <span className={`cc-logo inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} intro={intro} />
      <span className={`font-display text-[1.2rem] font-semibold leading-none tracking-[-0.02em] text-fg ${compact ? "hidden sm:inline" : ""}`}>
        Cam<span className="font-normal text-accent">Compare</span>
        <span className="sr-only"> ({SITE_NAME})</span>
      </span>
    </span>
  );
}
