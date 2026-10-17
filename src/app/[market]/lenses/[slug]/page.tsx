import { notFound } from "next/navigation";
import { lens, pricedSlugs } from "@/lib/catalog";
import { isMarket } from "@/lib/markets";
import LensView, { lensMetadata } from "@/views/LensView";
import { marketParam } from "../../market";

// See [market]/cameras/[slug]: prerendered where priced, on demand otherwise.
export const dynamicParams = true;
export const generateStaticParams = ({ params }: { params: { market: string } }) =>
  isMarket(params.market) ? pricedSlugs(params.market).filter((s) => lens(s)).map((slug) => ({ slug })) : [];

type P = { params: { market: string; slug: string } };
export const generateMetadata = ({ params }: P) => lensMetadata(params.slug, marketParam(params));
export default function Page({ params }: P) {
  const m = marketParam(params);
  if (!lens(params.slug)) notFound();
  return <LensView slug={params.slug} market={m} />;
}
