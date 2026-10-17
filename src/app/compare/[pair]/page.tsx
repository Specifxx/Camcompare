import { notFound, permanentRedirect } from "next/navigation";
import { comparePairs, pairSlug, parsePairSlug } from "@/lib/catalog";
import PairView, { pairMetadata } from "@/views/PairView";

export const dynamicParams = false;
export const generateStaticParams = () => comparePairs().map(([a, b]) => ({ pair: pairSlug(a.item, b.item) }));
export const generateMetadata = ({ params }: { params: { pair: string } }) => pairMetadata(params.pair);

export default function Page({ params }: { params: { pair: string } }) {
  const p = parsePairSlug(params.pair);
  if (!p) notFound();
  if (pairSlug(p[0].item, p[1].item) !== params.pair) permanentRedirect(`/compare/${pairSlug(p[0].item, p[1].item)}`);
  return <PairView pair={params.pair} />;
}
