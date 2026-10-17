// The visitor's country from Vercel's edge header, for GeoSuggest. Tiny; it
// reads no data. Locally there is no header: null. Private (never in a shared
// cache), but the browser keeps it for a day: GeoSuggest asks on every page
// load until a market is chosen, and most visitors never choose one.
export const runtime = "edge";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const country = req.headers.get("x-vercel-ip-country");
  return Response.json({ country: country && /^[A-Z]{2}$/.test(country) ? country : null }, { headers: { "Cache-Control": "private, max-age=86400" } });
}
