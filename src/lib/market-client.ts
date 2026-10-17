// Market helpers for client components: which market a path belongs to, the
// same page in another market, and the visitor's remembered choice.
import { DEFAULT_MARKET, isMarket, MARKETS, PREFIXED_MARKETS, type MarketCode } from "./markets";

export function marketFromPath(pathname: string): MarketCode {
  const first = pathname.split("/")[1] ?? "";
  return isMarket(first) && first !== DEFAULT_MARKET ? first : DEFAULT_MARKET;
}

/** Pages that exist once for every market (no prefix): stay where you are. */
const GLOBAL = /^\/(compare\/[^/]+|about|disclosure|credits|privacy|guides)(\/|$)/;

export function switchMarketPath(pathname: string, to: MarketCode): string {
  const from = marketFromPath(pathname);
  const rest = from === DEFAULT_MARKET ? pathname : pathname.slice(MARKETS[from].prefix.length) || "/";
  if (GLOBAL.test(rest)) return rest;
  return `${MARKETS[to].prefix}${rest === "/" && MARKETS[to].prefix ? "" : rest}` || "/";
}

export const COOKIE = "cc_market";

export function rememberMarket(m: MarketCode) {
  try {
    document.cookie = `${COOKIE}=${m}; path=/; max-age=31536000; samesite=lax`;
    localStorage.setItem(COOKIE, m);
  } catch {
    /* storage can be blocked; the choice just isn't remembered */
  }
}

export function rememberedMarket(): MarketCode | null {
  try {
    const v = localStorage.getItem(COOKIE) ?? document.cookie.match(/(?:^|; )cc_market=([a-z]+)/)?.[1] ?? null;
    return v && isMarket(v) ? v : null;
  } catch {
    return null;
  }
}

/** ISO country → market, for the "see prices in your country" suggestion. */
const EU = new Set(["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"]);
export function marketForCountry(cc: string | null): MarketCode | null {
  if (!cc) return null;
  const c = cc.toUpperCase();
  if (c === "US") return "us";
  if (c === "GB") return "uk";
  if (c === "AU") return "au";
  if (c === "SG") return "sg";
  return EU.has(c) ? "eu" : null;
}

export { PREFIXED_MARKETS };
