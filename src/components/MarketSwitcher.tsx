"use client";
import { usePathname, useRouter } from "next/navigation";
import { MARKET_CODES, MARKETS, type MarketCode } from "@/lib/markets";
import { isGlobalPath, rememberMarket, switchMarketPath } from "@/lib/market-client";

export default function MarketSwitcher({ current }: { current: MarketCode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  return (
    <label className="relative shrink-0">
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
        className="h-9 rounded-xl border border-line bg-surface pl-2.5 pr-1 text-sm font-medium"
      >
        {MARKET_CODES.map((m) => (
          <option key={m} value={m}>
            {MARKETS[m].flag} {MARKETS[m].short} · {MARKETS[m].currency}
          </option>
        ))}
      </select>
    </label>
  );
}
