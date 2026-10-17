// CamCompare mark: a six-blade iris. Rust (film-stock warm) is the brand; the one amber blade is
// the "spark" (the best price). Geometry: each blade is the 60° wedge at a
// hexagon vertex, clipped to the circle, with a gap (scripted, not hand-drawn).
// Where CSS `d` is supported the iris opens once on load and stops down on
// hover (globals.css, "Iris"); elsewhere, and under reduced motion, it is still.
import type { CSSProperties } from "react";
import { SITE_NAME } from "@/lib/site";

const OPEN = [
  "M21.65 14.59L30.53 19.71A15 15 0 0 1 21.65 29.9Z",
  "M20.05 20.19L20.05 30.44A15 15 0 0 1 6.79 27.84Z",
  "M14.4 21.6L5.52 26.73A15 15 0 0 1 1.14 13.95Z",
  "M10.35 17.41L1.47 12.29A15 15 0 0 1 10.35 2.1Z",
  "M11.95 11.81L11.95 1.56A15 15 0 0 1 25.21 4.16Z",
  "M17.6 10.4L26.48 5.27A15 15 0 0 1 30.86 18.05Z",
];
const STOP = [
  "M20.01 16.38L28.61 24.12A15 15 0 0 1 16.91 30.97Z",
  "M17.68 19.66L15.27 30.98A15 15 0 0 1 3.49 24.28Z",
  "M13.67 19.29L2.66 22.86A15 15 0 0 1 2.58 9.3Z",
  "M11.99 15.62L3.39 7.88A15 15 0 0 1 15.09 1.03Z",
  "M14.32 12.34L16.73 1.02A15 15 0 0 1 28.51 7.72Z",
  "M18.33 12.71L29.34 9.14A15 15 0 0 1 29.42 22.7Z",
];
const CLOSED = [
  "M17.06 17.7L22.56 29.49A15 15 0 0 1 8.97 29.25Z",
  "M15.06 17.76L7.59 28.42A15 15 0 0 1 1.01 16.53Z",
  "M14 16.07L1.04 14.93A15 15 0 0 1 8.04 3.29Z",
  "M14.94 14.3L9.44 2.51A15 15 0 0 1 23.03 2.75Z",
  "M16.94 14.24L24.41 3.58A15 15 0 0 1 30.99 15.47Z",
  "M18 15.93L30.96 17.07A15 15 0 0 1 23.96 28.71Z",
];
// Lit from the upper left: darkest blade lower right; blade 5 is the spark.
const FILL = ["var(--iris-0)", "var(--iris-1)", "var(--iris-2)", "var(--iris-3)", "var(--iris-4)", "var(--iris-spark)"];

export function LogoMark({ size = 28, intro = false, className = "" }: { size?: number; intro?: boolean; className?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 32 32" className={`cc-iris${intro ? " cc-iris-intro" : ""} shrink-0 ${className}`}>
      {OPEN.map((d, i) => (
        <path
          key={i}
          d={d}
          style={{ fill: FILL[i], "--d-open": `path("${d}")`, "--d-stop": `path("${STOP[i]}")`, "--d-closed": `path("${CLOSED[i]}")` } as CSSProperties}
        />
      ))}
    </svg>
  );
}

/** Mark + wordmark. `compact` hides the wordmark below sm. */
export default function Logo({ size = 28, compact = false, intro = false, className = "" }: { size?: number; compact?: boolean; intro?: boolean; className?: string }) {
  return (
    <span className={`cc-logo inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} intro={intro} />
      <span className={`font-display text-[1.2rem] font-semibold leading-none tracking-[-0.02em] text-fg ${compact ? "hidden sm:inline" : ""}`}>
        Cam<span className="font-normal italic text-muted">Compare</span>
        <span className="sr-only"> ({SITE_NAME})</span>
      </span>
    </span>
  );
}
