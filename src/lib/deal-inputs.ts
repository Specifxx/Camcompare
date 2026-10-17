// The deal inputs for one market, shared by the home page (views/HomeView.tsx)
// and the deal log (scripts/update-deal-log.ts), so both see the same deals:
// every published product with its offers and this market's launch RRP in
// the market's own currency (never converted). Server only (reads the catalog).
import { launchPrice, offersFor, publishedCameras, publishedLenses } from "./catalog";
import type { HomeDealInput } from "./deals-home";
import { MARKETS, type MarketCode } from "./markets";

export function dealInputs(m: MarketCode): HomeDealInput[] {
  const cur = MARKETS[m].currency;
  return [...publishedCameras().map((p) => ({ p, kind: "camera" as const })), ...publishedLenses().map((p) => ({ p, kind: "lens" as const }))].map(({ p, kind }) => {
    const l = launchPrice(p, m);
    return { slug: p.slug, kind, offers: offersFor(p.slug, m), rrpMinor: l && l.currency === cur ? Math.round(l.amount * 100) : null };
  });
}
