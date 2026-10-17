import { notFound } from "next/navigation";
import { comparePairs, pairSlug, parsePairSlug } from "@/lib/catalog";
import PairView, { pairMetadata } from "@/views/PairView";

// Only the slug-ordered pair exists, which every link and the sitemap use. A
// hand-typed reversed URL is a 404, not a redirect: dynamicParams = false
// answers before Page runs, and prerendering every reversed slug as a
// redirect would double the pair pages for URLs nothing links to.
export const dynamicParams = false;
export const generateStaticParams = () => comparePairs().map(([a, b]) => ({ pair: pairSlug(a.item, b.item) }));
export const generateMetadata = ({ params }: { params: { pair: string } }) => pairMetadata(params.pair);

export default function Page({ params }: { params: { pair: string } }) {
  const p = parsePairSlug(params.pair);
  if (!p) notFound();
  return <PairView pair={params.pair} />;
}
