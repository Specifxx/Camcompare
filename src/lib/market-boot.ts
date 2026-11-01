// The visitor's own market by default (owner, 2026-11-01: "the default region is the region that the visitor is located
// in. And if they can't determine it, then the default should be the US"). See lib/region-boot.ts.
import { GLOBAL } from "./market-client";
import { MARKET_CODES, PREFIXED_MARKETS } from "./markets";
import { regionBootScript } from "./region-boot";

/**
 * A person, never a crawler, on a market page of another market goes to the same page in theirs (the market they picked,
 * `cc_market`, else their time zone's, else the US) through the page's hreflang alternate. Global pages (/compare/<pair>,
 * guides, about…) never move. The EU market is found by its en-IE alternate (it lists every EU country).
 */
export const MARKET_BOOT_SCRIPT = regionBootScript({
  key: "cc_market",
  hreflang: Object.fromEntries(MARKET_CODES.map((m) => [m, m === "eu" ? "en-IE" : m === "uk" ? "en-GB" : `en-${m.toUpperCase()}`])),
  zones: [
    ["au", "^Australia/"],
    ["uk", "^Europe/(London|Belfast|Guernsey|Jersey|Isle_of_Man)$"],
    ["sg", "^Asia/Singapore$"],
    ["eu", "^Europe/"],
  ],
  fallback: "us",
  pageRegion: `new RegExp(${JSON.stringify(GLOBAL.source)}).test(p)?null:${JSON.stringify(PREFIXED_MARKETS)}.indexOf(s)>=0?s:"us"`,
});
