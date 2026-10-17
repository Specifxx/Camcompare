import { notFound } from "next/navigation";
import { isMarket, PREFIXED_MARKETS } from "@/lib/markets";

// /uk, /eu, /au, /sg. The US is the site root, so /us 404s. No
// `dynamicParams = false` here: it would cascade to [slug] below, whose
// unpriced market pages render on demand. Each page without a slug sets it
// instead (a page's own config applies to its route only), so a junk first
// segment is the static 404 rather than a render whose 404 is then cached.
// The notFound() below still guards the [slug] routes.
export const generateStaticParams = () => PREFIXED_MARKETS.map((market) => ({ market }));

export default function MarketLayout({ children, params }: { children: React.ReactNode; params: { market: string } }) {
  if (!isMarket(params.market) || params.market === "us") notFound();
  return children;
}
