// The home hero: warm light leaks like the end of a roll, bokeh (some
// hexagonal, after the iris), a lens flare from the top right and film grain,
// all decoration (aria-hidden) behind the real content. The background
// breaks out full-bleed and reaches up behind the (clear-at-top) header.
// Server component: every word and link is in the server HTML; motion is CSS
// (globals.css, "Hero") and stops under reduced motion.
import Link from "next/link";
import type { CSSProperties } from "react";
import SearchBox from "@/components/SearchBox";
import { MARKETS, marketPath, type MarketCode } from "@/lib/markets";
import HeroScroll from "./HeroScroll";

export type HeroStat = { value: string; label: string };
export type HeroChip = { href: string; label: string };

const WARM = "255 165 70", COOL = "225 80 55", WHITE = "255 240 215", AZURE = "255 205 80";
// [top %, left %, size px, colour, hexagonal, seconds]
const BOKEH: [number, number, number, string, boolean, number][] = [
  [10, 72, 120, WARM, false, 16], [20, 88, 64, WARM, true, 12], [36, 80, 28, WHITE, false, 10], [8, 55, 40, COOL, false, 14],
  [54, 92, 90, COOL, false, 18], [64, 70, 36, WARM, true, 11], [26, 8, 70, COOL, false, 15], [60, 4, 44, WARM, false, 13],
  [76, 26, 24, WHITE, false, 9], [42, 34, 18, WHITE, false, 12], [72, 52, 54, AZURE, true, 17], [6, 28, 30, WARM, false, 14],
];
// Flare ghosts along the axis from the light (top right) through the centre.
const GHOSTS: [number, number, number, string, boolean, number][] = [
  [22, 66, 46, AZURE, true, 0.6], [38, 52, 22, WARM, false, 1], [54, 38, 70, COOL, false, 1.4], [70, 24, 30, "240 120 60", true, 1.9],
];

export default function Hero({ market: m, place, stats, chips, searchPlaceholder, children }: { market: MarketCode; place: string; stats: HeroStat[]; chips: HeroChip[]; searchPlaceholder: string; children: React.ReactNode }) {
  const mk = MARKETS[m];
  return (
    <section id="cc-hero" aria-labelledby="hero-title" className="relative isolate -mt-6 pb-8 pt-10 text-center sm:pb-12 sm:pt-16 lg:pt-20">
      <div aria-hidden className="cc-hero-bg">
        <div className="cc-depth-slow absolute inset-0">
          <div className="cc-leak cc-leak-cool" />
          <div className="cc-leak cc-leak-warm" />
          <div className="cc-leak cc-leak-rose" />
          <div className="cc-leak cc-leak-azure" />
        </div>
        <div className="cc-depth-fast absolute inset-0">
          {BOKEH.map(([y, x, s, b, hex, t], i) => (
            <span key={i} className={`cc-bokeh${hex ? " hex" : ""}${s > 80 ? " hidden sm:block" : ""}`} style={{ "--y": `${y}%`, "--x": `${x}%`, "--s": `${s}px`, "--b": b, "--t": `${t}s`, "--dl": `${-i * 1.3}s` } as CSSProperties} />
          ))}
        </div>
        <div className="cc-flare-streak" />
        <div className="cc-flare-core" />
        {GHOSTS.map(([y, x, s, b, hex, k], i) => (
          <span key={i} className={`cc-ghost${hex ? " hex" : ""}`} style={{ "--y": `${y}%`, "--x": `${x}%`, "--s": `${s}px`, "--b": b, "--k": k } as CSSProperties} />
        ))}
        <div className="cc-grain" />
        <div className="cc-hero-fade" />
      </div>

      {/* Viewfinder corners framing the hero (lg+). */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 inset-y-4 hidden lg:block">
        <span className="cc-vf left-0 top-0 border-l-2 border-t-2" />
        <span className="cc-vf right-0 top-0 border-r-2 border-t-2" />
        <span className="cc-vf bottom-0 left-0 border-b-2 border-l-2" />
        <span className="cc-vf bottom-0 right-0 border-b-2 border-r-2" />
      </div>

      <div className="cc-hero-copy mx-auto max-w-4xl">
        <p className="cc-in inline-flex items-center gap-2 rounded-full border border-line/80 bg-surface/70 px-3 py-1 text-xs font-medium text-muted backdrop-blur" style={{ "--i": 0 } as CSSProperties}>
          <span aria-hidden className="cc-live-dot" />
          {mk.flag} Prices for {mk.name} · {mk.currency}
        </p>
        <p className="cc-in mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-subtle" style={{ "--i": 0 } as CSSProperties}>
          Made by people who shoot, for people who shoot
        </p>
        <h1 id="hero-title" className="cc-focus cc-h1 mx-auto mt-3 text-[2.2rem] font-semibold leading-[1.04] tracking-[-0.02em] sm:text-5xl lg:text-[4rem]">
          Camera &amp; lens prices and specs, <br className="hidden sm:inline" />
          <span className="cc-af cc-af-word inline-block px-2 [--af-in:-4px] sm:[--af-in:-8px]">
            <em className="cc-h1-em text-accent">side by side</em>
          </span>
        </h1>
        <p className="cc-in mx-auto mt-5 max-w-2xl text-base text-muted sm:text-lg" style={{ "--i": 1 } as CSSProperties}>
          Pick a body, find the glass, then see who&apos;s selling it cheapest: new, used or refurb. Specs straight off the makers&apos; sheets, prices from shops in {place}, checked every day.
        </p>
      </div>

      <div className="cc-in relative z-20 mx-auto mt-7 max-w-2xl px-1" style={{ "--i": 2 } as CSSProperties}>
        <div className="cc-af cc-af-search">
          <SearchBox market={m} variant="hero" placeholder={searchPlaceholder} />
        </div>
      </div>

      {chips.length > 0 && (
        <div className="cc-in mx-auto mt-5 flex max-w-3xl flex-wrap items-center justify-center gap-2" style={{ "--i": 3 } as CSSProperties}>
          <span className="eyebrow text-subtle">Popular</span>
          {chips.map((c, i) => (
            <Link key={c.href} href={c.href} prefetch={false} className={`rounded-full border border-line/80 bg-surface/70 px-3 py-1 text-sm text-fg no-underline backdrop-blur transition-colors hover:border-accent hover:text-accent hover:no-underline${i > 3 ? " hidden sm:inline-block" : ""}`}>
              {c.label}
            </Link>
          ))}
        </div>
      )}

      <div className="cc-in mt-6 flex flex-wrap justify-center gap-2" style={{ "--i": 4 } as CSSProperties}>
        {children}
      </div>

      {/* The numbers on a strip of film, frame numbers and all. */}
      <div className="cc-in cc-film mx-auto mt-10 max-w-3xl rounded-[3px] shadow-lift" style={{ "--i": 5 } as CSSProperties}>
        <dl className="grid grid-cols-2 gap-1.5 px-2 text-left sm:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className="relative rounded-[2px] bg-[#f6ecd8] px-3.5 py-2.5 text-[#2a2018]">
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6b5a48]">{s.label}</dt>
              <dd className="mt-0.5 font-display text-2xl font-semibold tabular-nums tracking-tight">{s.value}</dd>
              <span aria-hidden className="absolute right-2 top-1.5 font-mono text-[9px] text-[#a0521f]">{i + 1}A</span>
            </div>
          ))}
        </dl>
      </div>
      <HeroScroll target="cc-hero" />
    </section>
  );
}
