import Link from "next/link";
import { CHRISTMAS_FESTIVE_LAYER } from "@/lib/season";

// Christmas (1 November to Boxing Day, src/lib/season.ts): a one-line card in the home hero, in the site's own colours with
// a cranberry left border and a pine badge (globals.css .xmas-gift). Owner, 2026-11-08: the first Christmas look was too
// much; 2026-11-12: more festive again, tastefully. CamCompare has no gift-guide page, so it links the market's deals page
// (as the old pill did). Server HTML all year, shown only while <html> carries data-season="christmas", so it switches
// itself on and off with no deploy. Not a heading. With CHRISTMAS_FESTIVE_LAYER false it is the plain deals pill again.
export function ChristmasBanner({ href }: { href: string }) {
  if (!CHRISTMAS_FESTIVE_LAYER) {
    return (
      <div className="xmas-pill-row mt-4 justify-center">
        <Link href={href} prefetch={false} className="xmas-pill">
          <b>Holiday camera deals</b>
          <span className="xmas-pill-more hidden sm:inline">· real price drops, checked every day →</span>
        </Link>
      </div>
    );
  }
  return (
    <div className="xmas-gift" data-xmas-gift>
      <Link href={href} prefetch={false}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="8" width="18" height="4" rx="1" />
          <path d="M5 12v8h14v-8M12 8v12M12 8c-2.5 0-4-1-4-2.5S9.5 3 12 8c2.5-5 4-3.5 4-2.5S14.5 8 12 8z" />
        </svg>
        <span className="xmas-gift-text">
          <b>Christmas camera deals</b>
          <span className="xmas-gift-sub">Real price drops on cameras and lenses, checked every day</span>
        </span>
        <span className="xmas-gift-badge">See deals →</span>
      </Link>
    </div>
  );
}
