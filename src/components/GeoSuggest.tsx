"use client";
// "Looks like you're in the UK — see UK prices?" One small request to
// /api/geo (Vercel's IP country header), shown once, never a redirect:
// search engines and travellers see the page they asked for.
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MARKETS, type MarketCode } from "@/lib/markets";
import { isGlobalPath, marketForCountry, rememberMarket, rememberedMarket, switchMarketPath, useMarket } from "@/lib/market-client";

const GEO_KEY = "cc_geo";
const GEO_TTL_MS = 30 * 24 * 3_600_000;

export default function GeoSuggest() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [suggest, setSuggest] = useState<MarketCode | null>(null);
  const here = useMarket(pathname);

  // Once per page load (the layout stays mounted across navigations); the
  // render compares the country's market with the page's.
  useEffect(() => {
    if (rememberedMarket()) return;
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem("cc_geo_dismissed") === "1";
    } catch {
      /* ignore */
    }
    if (dismissed) return;
    // The country, once per browser per 30 days: each /api/geo call is a
    // function invocation, and a visitor's country rarely changes.
    try {
      const kept = JSON.parse(localStorage.getItem(GEO_KEY) ?? "null") as { country: string | null; at: number } | null;
      if (kept && Date.now() - kept.at < GEO_TTL_MS) return setSuggest(marketForCountry(kept.country));
    } catch {
      /* ignore */
    }
    fetch("/api/geo")
      .then((r) => r.json())
      .then((d: { country: string | null }) => {
        try {
          localStorage.setItem(GEO_KEY, JSON.stringify({ country: d.country, at: Date.now() }));
        } catch {
          /* ignore */
        }
        setSuggest(marketForCountry(d.country));
      })
      .catch(() => {});
  }, []);

  if (!suggest || suggest === here) return null;
  const close = () => {
    setSuggest(null);
    try {
      sessionStorage.setItem("cc_geo_dismissed", "1");
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="border-b border-line bg-accent-soft">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
        <span>
          {MARKETS[suggest].flag} Shopping from {MARKETS[suggest].name}? See prices in {MARKETS[suggest].currency} from local retailers.
        </span>
        <button
          className="font-semibold text-accent"
          onClick={() => {
            rememberMarket(suggest);
            if (!isGlobalPath(pathname)) router.push(switchMarketPath(pathname, suggest) + window.location.search);
            setSuggest(null);
          }}
        >
          Switch to {MARKETS[suggest].short}
        </button>
        <button className="text-muted" onClick={() => { rememberMarket(here); close(); }}>
          Stay on {MARKETS[here].short}
        </button>
      </div>
    </div>
  );
}
