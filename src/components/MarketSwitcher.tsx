"use client";
import { usePathname, useRouter } from "next/navigation";
import { MARKET_CODES, MARKETS, type MarketCode } from "@/lib/markets";
import { isGlobalPath, rememberMarket, switchMarketPath } from "@/lib/market-client";
import { Flag } from "./Flag";

// The header's market menu: the market's drawn flag and code (Flag.tsx; an
// emoji flag is two letters on Windows), with a native select laid invisibly
// over them, so it stays keyboard- and screen-reader-friendly (owner,
// 2026-11-02: flags on the region switcher).
export default function MarketSwitcher({ current }: { current: MarketCode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  return (
    <label className="relative flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 text-sm font-medium focus-within:ring-2 focus-within:ring-accent/50 hover:border-accent/50">
      <Flag code={current} />
      <span>{MARKETS[current].short}</span>
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-muted" aria-hidden="true">
        <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="sr-only">Prices for</span>
      <select
        value={current}
        onChange={(e) => {
          const to = e.target.value as MarketCode;
          rememberMarket(to);
          // A global page has no other-market URL: remembering is the switch
          // (the header and price row follow it). The query (?c=, ?mount=) stays.
          if (!isGlobalPath(pathname)) router.push(switchMarketPath(pathname, to) + window.location.search);
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {MARKET_CODES.map((m) => (
          <option key={m} value={m}>
            {MARKETS[m].name} · {MARKETS[m].currency}
          </option>
        ))}
      </select>
    </label>
  );
}
