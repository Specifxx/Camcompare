"use client";
import Link from "next/link";
import { MARKET_CODES, MARKETS, type MarketCode } from "@/lib/markets";
import { rememberMarket } from "@/lib/market-client";
import { Flag } from "./Flag";

// The home hero's market row (owner, 2026-11-02: "the region switcher must be
// more prevalent … on the main home page hero … and have the flags as well"):
// every market's home as a flag chip, the current one marked with its
// currency. Plain links (each market has a home), and the pick is remembered
// as the header's switcher remembers it, so GeoSuggest stops asking.
export default function MarketChips({ current }: { current: MarketCode }) {
  return (
    <nav aria-label="Choose your market" className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-sm font-medium text-muted">Prices for</span>
      {MARKET_CODES.map((m) => {
        const on = m === current;
        return (
          <Link
            key={m}
            href={MARKETS[m].prefix || "/"}
            prefetch={false}
            onClick={() => rememberMarket(m)}
            aria-current={on ? "page" : undefined}
            title={`${MARKETS[m].name} · ${MARKETS[m].currency}`}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold no-underline transition hover:no-underline ${
              on ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-fg hover:border-accent/50"
            }`}
          >
            <Flag code={m} />
            <span className="sm:hidden">{MARKETS[m].short}</span>
            <span className="hidden sm:inline">{MARKETS[m].name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
