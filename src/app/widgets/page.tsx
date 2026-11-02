import type { Metadata } from "next";
import Link from "next/link";
import { offersFor, publishedCameras } from "@/lib/catalog";
import { linkBadge } from "@/lib/link-badges";
import { SITE_NAME, abs } from "@/lib/site";

// Free link badges (DECISIONS.md, "Free link badges", 2026-11-02): what outreach offers instead of asking for a link.
// Plain HTML only: no iframe or script, so nothing reads data at request time. Static, built with the site.
export const metadata: Metadata = {
  title: "Free camera price links for reviews and clubs",
  description: "Free plain-HTML badges that send your readers to a camera or lens price comparison: new, used and refurbished, across stores in five markets. No script, no signup.",
  alternates: { canonical: "/widgets" },
};

function Snippet({ html }: { html: string }) {
  return (
    <div className="mt-3 rounded-lg border border-line p-4">
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <pre className="mt-3 overflow-x-auto rounded bg-black/5 p-3 text-xs"><code>{html}</code></pre>
    </div>
  );
}

export default function Widgets() {
  // A camera most US stores sell, so the unedited snippet points at a full comparison.
  const c = [...publishedCameras()].sort((a, b) => offersFor(b.slug, "us").length - offersFor(a.slug, "us").length)[0];
  return (
    <div className="max-w-2xl space-y-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-extrabold tracking-tight">Free camera price links</h1>
      <p>
        For camera reviews, photo club pages, gear guides and stores: one line of HTML that sends readers to today&apos;s new, used and refurbished
        prices across the stores we check, with specs side by side. No script, no image, no tracking, free.
      </p>
      <h2 className="h-section pt-2">A camera or lens you review</h2>
      <p>Change the address to any camera or lens page on {SITE_NAME} and the text to its name. For another market, add <code>/uk</code>, <code>/eu</code>, <code>/au</code> or <code>/sg</code> before <code>/cameras</code>.</p>
      <Snippet html={linkBadge(abs(`/cameras/${c?.slug ?? "CAMERA-SLUG"}`), `${c?.name ?? "Camera name"} prices compared on ${SITE_NAME}`)} />
      <h2 className="h-section pt-2">Every camera or lens</h2>
      <Snippet html={linkBadge(abs("/cameras"), `Compare camera prices and specs on ${SITE_NAME}`)} />
      <Snippet html={linkBadge(abs("/lenses"), `Compare lens prices and specs on ${SITE_NAME}`)} />
      <h2 className="h-section pt-2">For stores we compare</h2>
      <p>Tell customers your prices are compared openly. <Link href="/disclosure" prefetch={false}>How we rank stores</Link>: always by price.</p>
      <Snippet html={linkBadge(abs("/"), `Our camera prices are compared on ${SITE_NAME}`)} />
    </div>
  );
}
