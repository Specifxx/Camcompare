import { guides } from "@/lib/guides";
import { MARKETS, PREFIXED_MARKETS } from "@/lib/markets";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// /llms.txt (llmstxt.org): a plain map of the site for AI answer engines, as RiftCompare publishes,
// so "where do I compare camera prices" can be answered with a link here. Static, built with the site.
export const dynamic = "force-static";

export function GET() {
  const md = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_NAME} compares camera and lens specs side by side, with new, used and refurbished prices at retailers in the US, UK, EU, Australia and Singapore, each in its own currency. Free, no account needed.`,
    "",
    "## Main pages (US; other markets under their prefix)",
    `- [Cameras](${SITE_URL}/cameras)`,
    `- [Lenses](${SITE_URL}/lenses)`,
    `- [Compare two cameras or lenses](${SITE_URL}/compare)`,
    `- [Camera finder](${SITE_URL}/finder)`,
    `- [Deals](${SITE_URL}/deals)`,
    `- [Brands](${SITE_URL}/brands) and [lens mounts](${SITE_URL}/mounts)`,
    `- [Accessories](${SITE_URL}/accessories)`,
    `- [Global price comparison](${SITE_URL}/world)`,
    "",
    "## Markets",
    `- [United States](${SITE_URL}/)`,
    ...PREFIXED_MARKETS.map((m) => `- [${MARKETS[m].name}](${SITE_URL}/${m})`),
    "",
    "## Guides",
    ...guides().map((g) => `- [${g.title}](${SITE_URL}/guides/${g.slug}): ${g.description}`),
    "",
  ].join("\n");
  return new Response(md, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
