// /check/<host>: one store's listings for the "Is this a good price?" checker (components/LinkChecker.tsx, 2026-11-08).
// One static file per host our listings link to, written with every page at the release's build from the committed
// offer files (lib/link-check-index.ts): never a function, any other host a 404, and the store's page is never fetched.
import { storeChecks } from "@/lib/link-check-index";
import { normaliseHost } from "@/lib/link-check";

export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() {
  return [...storeChecks().keys()].map((host) => ({ host }));
}

export function GET(_req: Request, { params }: { params: { host: string } }) {
  const body = storeChecks().get(normaliseHost(decodeURIComponent(params.host)));
  if (!body) return new Response("Not found", { status: 404 });
  return Response.json(body, { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
