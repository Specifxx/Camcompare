import { guides } from "@/lib/guides";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

// The guides as RSS 2.0, newest update first, as RiftCompare's /feed.xml. Static, built with the site.
export const dynamic = "force-static";

const x = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function GET() {
  const items = [...guides()]
    .sort((a, b) => b.updated.localeCompare(a.updated))
    .map((g) => {
      const url = `${SITE_URL}/guides/${g.slug}`;
      return `<item><title>${x(g.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${new Date(`${g.updated.slice(0, 10)}T00:00:00Z`).toUTCString()}</pubDate><description>${x(g.description)}</description></item>`;
    })
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${x(SITE_NAME)} guides</title><link>${SITE_URL}</link><description>${x(SITE_TAGLINE)}</description><language>en</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
