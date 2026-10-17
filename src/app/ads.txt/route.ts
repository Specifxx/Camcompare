// ads.txt for AdSense, from ADSENSE_PUBLISHER_ID (pub-…). Empty until set.
export const dynamic = "force-static";

export function GET() {
  const pub = (process.env.ADSENSE_PUBLISHER_ID || "").trim();
  const body = pub ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` : "# No ad networks yet.\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
