import { brand } from "@/lib/catalog";
import type { Camera, Lens } from "@/lib/catalog/schema";

/** The maker's search URL for a product, or its homepage when its search pattern isn't known. */
export function officialHref(p: Camera | Lens): { href: string; host: string; search: boolean } | null {
  const b = brand(p.brand);
  if (!b) return null;
  // Makers' searches know their own names better than part numbers ("EOS R6 Mark II", not "5666C002").
  const q = encodeURIComponent(p.shortName.replace(/α/g, "a"));
  const href = b.search ? b.search.replace("{q}", q) : b.site;
  return { href, host: new URL(b.site).hostname.replace(/^www\./, ""), search: Boolean(b.search) };
}

/** "Official page on leica-camera.com ↗": the maker's own page, not a paid link. */
export default function OfficialLink({ p }: { p: Camera | Lens }) {
  const o = officialHref(p);
  if (!o) return null;
  return (
    <a href={o.href} target="_blank" rel="noopener" className="text-sm">
      {o.search ? "Official page" : "Official site"} on {o.host} <span aria-hidden>↗</span>
      <span className="sr-only"> (opens the maker&apos;s site in a new tab)</span>
    </a>
  );
}
