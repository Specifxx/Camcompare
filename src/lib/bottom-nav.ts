// The phone bottom nav's switch and tabs (components/BottomNav.tsx, owner 2026-11-18; DECISIONS.md "Phone bottom nav").
// BOTTOM_NAV: "off" is the rollback (nothing renders, ?bn=1 included), "optin" shows it only to a visitor who opened a page with
// ?bn=1, "on" shows it to every phone visitor (?bn=0 still opts out). The tabs are worked out in the browser from the page.
import type { BottomNavMode, BottomNavTab } from "@/components/BottomNav";

export const BOTTOM_NAV: BottomNavMode = "optin";

import { DEFAULT_MARKET, isMarket, type MarketCode } from "@/lib/markets";

/** The header's search box (this site has no /search page: the Search tab focuses it). */
export const BOTTOM_NAV_SEARCH_INPUT = "header input[type='search'], header input[name='q'], header input[type='text']";

/** The page's market: the US at the root, the others under /uk, /eu, /au and /sg (lib/markets.ts). */
function marketFor(pathname: string): MarketCode {
  const seg = pathname.split("/")[1];
  return isMarket(seg) ? seg : DEFAULT_MARKET;
}

export function bottomNavTabs(pathname: string): BottomNavTab[] {
  const m = marketFor(pathname);
  const p = m === DEFAULT_MARKET ? "" : `/${m}`;
  return [
    { key: "home", label: "Home", href: p || "/", exact: true, icon: "home" },
    { key: "search", label: "Search", action: "search", icon: "search" },
    { key: "deals", label: "Deals", href: `${p}/deals`, icon: "deals" },
    { key: "cart", label: "Cart", action: "cart", icon: "cart" },
    { key: "menu", label: "Menu", action: "menu", icon: "menu" },
  ];
}
