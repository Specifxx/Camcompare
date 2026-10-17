"use client";
// Client component for the same reason as the header: "Camera systems" and
// "Saved" are per-market pages, so they follow the page's market. No link
// prefetches: the footer is on every page and /credits alone is the size of
// the catalog.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MARKET_CODES, MARKETS, marketPath } from "@/lib/markets";
import { useMarket } from "@/lib/market-client";
import { SITE_NAME } from "@/lib/site";
import Logo from "./brand/Logo";

export default function Footer() {
  const here = useMarket(usePathname() ?? "/");
  return (
    <footer className="relative mt-20 overflow-hidden border-t border-line/70 bg-surface">
      <div aria-hidden className="hairline-brand absolute inset-x-0 top-0" />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm text-muted sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link href={marketPath(here, "/")} prefetch={false} className="text-fg no-underline hover:no-underline" aria-label={`${SITE_NAME} home`}>
            <Logo size={30} />
          </Link>
          <p className="mt-3">Camera and lens prices from shops in five markets, specs off the makers&apos; own sheets. Built for people who&apos;d rather be out shooting than comparing tabs.</p>
          <p className="mt-3 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-subtle">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-buy" /> Prices checked daily
          </p>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Markets">
          <p className="eyebrow mb-1 text-subtle">Prices for</p>
          {MARKET_CODES.map((m) => (
            <Link key={m} href={MARKETS[m].prefix || "/"} prefetch={false}>
              {MARKETS[m].flag} {MARKETS[m].name}
            </Link>
          ))}
        </nav>
        <nav className="flex flex-col gap-1" aria-label="About">
          <p className="eyebrow mb-1 text-subtle">About</p>
          <Link href="/guides" prefetch={false}>Guides</Link>
          <Link href={marketPath(here, "/mounts")} prefetch={false}>Camera systems</Link>
          <Link href="/about" prefetch={false}>How we price &amp; check specs</Link>
          <Link href="/disclosure" prefetch={false}>Affiliate disclosure</Link>
          <Link href="/feedback" prefetch={false}>Send feedback</Link>
          <Link href="/privacy" prefetch={false}>Privacy</Link>
          <Link href="/credits" prefetch={false}>Photo credits</Link>
          <Link href={marketPath(here, "/saved")} prefetch={false}>Saved</Link>
          <Link href={marketPath(here, "/board")} prefetch={false}>Deals board (plain HTML)</Link>
        </nav>
        <p className="text-xs leading-relaxed">
          {SITE_NAME} earns a commission when you buy through some retailer links, at no cost to you. It never changes the order of offers, which are always sorted by price. As an Amazon Associate we earn from qualifying purchases.
        </p>
      </div>
      {/* The wordmark, oversized and faded: decoration only. */}
      <p aria-hidden className="pointer-events-none select-none whitespace-nowrap text-center font-display text-[17vw] font-semibold italic leading-[0.8] tracking-[-0.04em] text-fg/[0.06] lg:text-[11.5rem]">
        CamCompare
      </p>
    </footer>
  );
}
