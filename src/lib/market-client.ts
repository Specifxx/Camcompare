// Market helpers for client components: which market a path belongs to, the
// same page in another market, and the visitor's remembered choice.
import { useEffect, useState } from "react";
import { DEFAULT_MARKET, EU_COUNTRIES, isMarket, MARKETS, PREFIXED_MARKETS, type MarketCode } from "./markets";

/** "/uk//x/" → "/uk/x": one slash between segments, so a result can never be a "//host" URL. */
const clean = (pathname: string) => `/${pathname.split("/").filter(Boolean).join("/")}`;

export function marketFromPath(pathname: string): MarketCode {
  const first = clean(pathname).split("/")[1] ?? "";
  return isMarket(first) && first !== DEFAULT_MARKET ? first : DEFAULT_MARKET;
}

/** Pages that exist once for every market (no prefix): stay where you are. */
const GLOBAL = /^\/(compare\/[^/]+|about|disclosure|credits|privacy|guides)(\/|$)/;
export const isGlobalPath = (pathname: string) => GLOBAL.test(clean(pathname));

export function switchMarketPath(pathname: string, to: MarketCode): string {
  const path = clean(pathname);
  const from = marketFromPath(path);
  const rest = from === DEFAULT_MARKET ? path : path.slice(MARKETS[from].prefix.length) || "/";
  if (GLOBAL.test(rest)) return rest;
  return `${MARKETS[to].prefix}${rest === "/" && MARKETS[to].prefix ? "" : rest}` || "/";
}

export const COOKIE = "cc_market";
// The market of the last market page this tab showed, for the global pages
// (/compare/<pair>, /guides…) a visitor reaches from it. Per tab, and apart
// from the remembered choice: viewing a page is not choosing a market, and
// GeoSuggest still asks a visitor who landed on another country's page.
const SEEN = "cc_market_seen";
const EVENT = "cc-market";

export function rememberMarket(m: MarketCode) {
  try {
    document.cookie = `${COOKIE}=${m}; path=/; max-age=31536000; samesite=lax`;
    localStorage.setItem(COOKIE, m);
  } catch {
    /* storage can be blocked; the choice just isn't remembered */
  }
  noteMarket(m, true);
}

/** Records the market in view and tells useVisitorMarket when it changed (or was chosen). */
function noteMarket(m: MarketCode, chosen = false) {
  let changed = chosen;
  try {
    if (sessionStorage.getItem(SEEN) !== m) {
      sessionStorage.setItem(SEEN, m);
      changed = true;
    }
  } catch {
    /* blocked: global pages fall back to the remembered choice */
  }
  if (changed) window.dispatchEvent(new Event(EVENT));
}

export function rememberedMarket(): MarketCode | null {
  try {
    const v = localStorage.getItem(COOKIE) ?? document.cookie.match(/(?:^|; )cc_market=([a-z]+)/)?.[1] ?? null;
    return v && isMarket(v) ? v : null;
  } catch {
    return null;
  }
}

/** The market a global page shows: the last market page in this tab, else the remembered choice. */
export function visitorMarket(): MarketCode | null {
  try {
    const v = sessionStorage.getItem(SEEN);
    if (v && isMarket(v)) return v;
  } catch {
    /* fall back to the remembered choice */
  }
  return rememberedMarket();
}

/**
 * visitorMarket(), read after mount (so hydration matches the server's
 * render) and again whenever it changes. Null until then.
 */
export function useVisitorMarket(): MarketCode | null {
  const [m, setM] = useState<MarketCode | null>(null);
  useEffect(() => {
    const read = () => setM(visitorMarket());
    read();
    window.addEventListener(EVENT, read);
    return () => window.removeEventListener(EVENT, read);
  }, []);
  return m;
}

/**
 * The market a page shops in: its path's, or on a global page the visitor's
 * (US until mounted). Market pages note theirs for the global pages after.
 */
export function useMarket(pathname: string): MarketCode {
  const fromPath = marketFromPath(pathname);
  const global = isGlobalPath(pathname);
  const visitor = useVisitorMarket();
  useEffect(() => {
    if (!global) noteMarket(fromPath);
  }, [global, fromPath]);
  return global ? (visitor ?? DEFAULT_MARKET) : fromPath;
}

/** ISO country → market, for the "see prices in your country" suggestion. */
const EU = new Set<string>(EU_COUNTRIES);
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
