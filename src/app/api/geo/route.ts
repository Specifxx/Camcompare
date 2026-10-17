// The visitor's country from Vercel's edge header, for GeoSuggest. Private,
// uncached, tiny; it reads no data. Locally there is no header: null.
export const runtime = "edge";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const country = req.headers.get("x-vercel-ip-country");
  return Response.json({ country: country && /^[A-Z]{2}$/.test(country) ? country : null }, { headers: { "Cache-Control": "private, no-store" } });
}
