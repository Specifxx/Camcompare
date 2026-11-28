// The deals card's products for one market (lib/deal-picks.ts): one static JSON per market and build (force-static, every
// market prerendered), fetched by components/DealsPopup.tsx after hydration.
import { dealPicksFor } from "@/lib/deal-picks";
import { isMarket, MARKET_CODES } from "@/lib/markets";

export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() {
  return MARKET_CODES.map((market) => ({ market }));
}

export function GET(_req: Request, { params }: { params: { market: string } }) {
  if (!isMarket(params.market)) return new Response("Not found", { status: 404 });
  return Response.json(dealPicksFor(params.market), { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
