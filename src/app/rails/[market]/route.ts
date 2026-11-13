// The ad tiles for one market (lib/side-rails.ts): one static JSON per market and build (force-static, every market
// prerendered), fetched by components/useAdFeed.ts, for the in-page ad block and the phone dock.
import { railsFor } from "@/lib/side-rails";
import { isMarket, MARKET_CODES } from "@/lib/markets";

export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() {
  return MARKET_CODES.map((market) => ({ market }));
}

export function GET(_req: Request, { params }: { params: { market: string } }) {
  if (!isMarket(params.market)) return new Response("Not found", { status: 404 });
  return Response.json(railsFor(params.market), { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
