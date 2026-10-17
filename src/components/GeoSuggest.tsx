"use client";
// "Looks like you're in the UK — see UK prices?" One small request to
// /api/geo (Vercel's IP country header), shown once, never a redirect:
// search engines and travellers see the page they asked for.
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MARKETS, type MarketCode } from "@/lib/markets";
import { marketForCountry, marketFromPath, rememberMarket, rememberedMarket, switchMarketPath } from "@/lib/market-client";

export default function GeoSuggest() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [suggest, setSuggest] = useState<MarketCode | null>(null);
  const here = marketFromPath(pathname);

  useEffect(() => {
    if (rememberedMarket()) return;
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem("cc_geo_dismissed") === "1";
    } catch {
      /* ignore */
    }
    if (dismissed) return;
    fetch("/api/geo")
      .then((r) => r.json())
      .then((d: { country: string | null }) => {
        const m = marketForCountry(d.country);
        if (m && m !== here) setSuggest(m);
      })
      .catch(() => {});
  }, [here]);

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
            router.push(switchMarketPath(pathname, suggest));
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
