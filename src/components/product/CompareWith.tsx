import Link from "next/link";
import { displayShortName, isIndexedPair, pairSlug, type AnyProduct } from "@/lib/catalog";
import { marketPath, type MarketCode } from "@/lib/markets";

/**
 * "Compare with" under the hero's price (site review CAM-3, 2026-11-10): up to three of the product's rivals, so a visitor
 * who lands from Google on a product page has a next step on the first phone screen. /compare pages won 52 of 121 Google
 * clicks in the review's window; product pages are where people land. An indexed pair (each names the other) links its
 * /compare/<a>-vs-<b> page; any other rival links the noindex builder with rel="nofollow", as everywhere else.
 */
export default function CompareWith({ self, rivals, market }: { self: AnyProduct; rivals: AnyProduct[]; market: MarketCode }) {
  const list = [...rivals].sort((a, b) => Number(isIndexedPair(self, b)) - Number(isIndexedPair(self, a))).slice(0, 3);
  if (!list.length) return null;
  return (
    <nav aria-label="Compare with" className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-subtle">Compare with</span>
      {list.map((r) => {
        const indexed = isIndexedPair(self, r);
        const href = indexed ? `/compare/${pairSlug(self.item, r.item)}` : marketPath(market, `/compare?c=${self.item.slug},${r.item.slug}`);
        return (
          <Link key={r.item.slug} href={href} rel={indexed ? undefined : "nofollow"} className="chip-link gap-1 font-semibold">
            {displayShortName(r.item, market)}
            {" "}
            <span aria-hidden>→</span>
          </Link>
        );
      })}
    </nav>
  );
}
