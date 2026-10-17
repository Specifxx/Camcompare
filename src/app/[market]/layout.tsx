import { notFound } from "next/navigation";
import { isMarket, PREFIXED_MARKETS } from "@/lib/markets";

// /uk, /eu, /au, /sg. The US is the site root, so /us 404s. No
// `dynamicParams = false` here: it would cascade to [slug] below, whose
// unpriced market pages render on demand. The notFound() below guards the
// market instead.
export const generateStaticParams = () => PREFIXED_MARKETS.map((market) => ({ market }));

export default function MarketLayout({ children, params }: { children: React.ReactNode; params: { market: string } }) {
  if (!isMarket(params.market) || params.market === "us") notFound();
  return children;
}
