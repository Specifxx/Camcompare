"use client";
import { usePathname, useRouter } from "next/navigation";
import { MARKET_CODES, MARKETS, type MarketCode } from "@/lib/markets";
import { rememberMarket, switchMarketPath } from "@/lib/market-client";

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
          router.push(switchMarketPath(pathname, to));
        }}
        className="rounded-lg border border-line bg-surface py-1.5 pl-2 pr-1 text-sm"
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
