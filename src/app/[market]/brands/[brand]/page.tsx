import { notFound } from "next/navigation";
import { brand } from "@/lib/catalog";
import BrandView, { brandMetadata, liveBrands } from "@/views/BrandView";
import { marketParam } from "../../market";

export const dynamicParams = false;
export const generateStaticParams = () => liveBrands().map((b) => ({ brand: b.slug }));
type P = { params: { market: string; brand: string } };
export const generateMetadata = ({ params }: P) => brandMetadata(params.brand, marketParam(params));
export default function Page({ params }: P) {
  if (!brand(params.brand)) notFound();
  return <BrandView slug={params.brand} market={marketParam(params)} />;
}
