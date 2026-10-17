// The five markets CamCompare prices (owner, 2026-10-17): US, UK, EU, AU, SG.
// The US lives at the site root; the others under a path prefix. Each market
// prices in its own currency and has its own retailers (lib/retailers.ts).
// Client-safe: no Node imports.

export const MARKET_CODES = ["us", "uk", "eu", "au", "sg"] as const;
export type MarketCode = (typeof MARKET_CODES)[number];
export const CURRENCIES = ["USD", "GBP", "EUR", "AUD", "SGD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type Market = {
  code: MarketCode;
  name: string; // "United Kingdom"
  short: string; // "UK"
  currency: Currency;
  locale: string; // number and date formatting
  hreflang: string;
  prefix: string; // "" for the US, "/uk" …
  flag: string;
};

export const MARKETS: Record<MarketCode, Market> = {
  us: { code: "us", name: "United States", short: "US", currency: "USD", locale: "en-US", hreflang: "en-US", prefix: "", flag: "🇺🇸" },
  uk: { code: "uk", name: "United Kingdom", short: "UK", currency: "GBP", locale: "en-GB", hreflang: "en-GB", prefix: "/uk", flag: "🇬🇧" },
  // One English-language EU market priced in euros. hreflang "en-IE" is the
  // English-speaking euro locale; retailers carry their own country.
  eu: { code: "eu", name: "Europe", short: "EU", currency: "EUR", locale: "en-IE", hreflang: "en-IE", prefix: "/eu", flag: "🇪🇺" },
  au: { code: "au", name: "Australia", short: "AU", currency: "AUD", locale: "en-AU", hreflang: "en-AU", prefix: "/au", flag: "🇦🇺" },
  sg: { code: "sg", name: "Singapore", short: "SG", currency: "SGD", locale: "en-SG", hreflang: "en-SG", prefix: "/sg", flag: "🇸🇬" },
};

export const DEFAULT_MARKET: MarketCode = "us";
export const PREFIXED_MARKETS = MARKET_CODES.filter((m) => m !== DEFAULT_MARKET);
export const isMarket = (s: string): s is MarketCode => (MARKET_CODES as readonly string[]).includes(s);
export const market = (code: MarketCode) => MARKETS[code];

/** A site path for a market: marketPath("uk", "/cameras/x") → "/uk/cameras/x". */
export const marketPath = (code: MarketCode, path: string) => `${MARKETS[code].prefix}${path === "/" && MARKETS[code].prefix ? "" : path}`;

/** Whole units in the market's currency, no decimals: "£1,899", "A$2,999". */
export function money(amount: number, currency: Currency, cents = false): string {
  const value = cents ? amount / 100 : amount;
  const symbol = { USD: "$", GBP: "£", EUR: "€", AUD: "A$", SGD: "S$" }[currency];
  return `${symbol}${Math.round(value).toLocaleString("en-US")}`;
}

// Reference rates (USD base) for SANITY CHECKS ONLY — never to show a
// converted price. Refusing a £50 "a7 IV" needs only a rough idea of value.
// Override with FX_USD_<CUR> when they drift.
const REF_RATES: Record<Currency, number> = { USD: 1, GBP: 0.79, EUR: 0.92, AUD: 1.52, SGD: 1.35 };
export function refRate(c: Currency): number {
  const env = typeof process !== "undefined" ? Number(process.env[`FX_USD_${c}`]) : NaN;
  return Number.isFinite(env) && env > 0 ? env : REF_RATES[c];
}
