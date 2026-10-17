import { notFound } from "next/navigation";
import { camera, pricedSlugs } from "@/lib/catalog";
import { isMarket } from "@/lib/markets";
import CameraView, { cameraMetadata } from "@/views/CameraView";
import { marketParam } from "../../market";

// Prerendered only where this market has prices (those pages are indexed);
// the rest render on first visit and are noindex until the market is priced.
// Keeps the build from being 5 × the catalog.
export const dynamicParams = true;
export const generateStaticParams = ({ params }: { params: { market: string } }) =>
  isMarket(params.market) ? pricedSlugs(params.market).filter((s) => camera(s)).map((slug) => ({ slug })) : [];

type P = { params: { market: string; slug: string } };
export const generateMetadata = ({ params }: P) => cameraMetadata(params.slug, marketParam(params));
export default function Page({ params }: P) {
  const m = marketParam(params);
  if (!camera(params.slug)) notFound();
  return <CameraView slug={params.slug} market={m} />;
}
