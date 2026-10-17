import { notFound } from "next/navigation";
import { brand } from "@/lib/catalog";
import BrandView, { brandMetadata, liveBrands } from "@/views/BrandView";

export const dynamicParams = false;
export const generateStaticParams = () => liveBrands().map((b) => ({ brand: b.slug }));
export const generateMetadata = ({ params }: { params: { brand: string } }) => brandMetadata(params.brand, "us");

export default function Page({ params }: { params: { brand: string } }) {
  if (!brand(params.brand)) notFound();
  return <BrandView slug={params.brand} market="us" />;
}
